import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { createGoalHook } from "./index"
import { releaseAllPromptAsyncReservationsForTesting } from "../shared/prompt-async-gate"

function makePluginInput(): PluginInput {
  return {
    directory: mkdtempSync(join(tmpdir(), "goal-hook-")),
    client: {
      session: {
        messages: {
          create: async () => ({ id: "msg-1" }),
        },
      },
    },
  } as unknown as PluginInput
}

describe("createGoalHook", () => {
  test("setGoal and getGoal round trip", () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })

    const goal = hook.setGoal("s1", "Ship it")

    expect(goal.objective).toBe("Ship it")
    expect(hook.getGoal("s1")?.objective).toBe("Ship it")
  })

  test("clearGoal removes goal", () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    hook.clearGoal("s1")

    expect(hook.getGoal("s1")).toBeNull()
  })

  test("session.deleted clears goal", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    await hook.event({ event: { type: "session.deleted", properties: { sessionID: "s1" } } })

    expect(hook.getGoal("s1")).toBeNull()
  })

  test("session.idle injects continuation for active goal", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    await hook.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } })

    // No crash; injection is best-effort.
    expect(hook.getGoal("s1")?.status).toBe("active")
  })

  test("session.idle skips paused goal", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")
    hook.pauseGoal("s1")

    await hook.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } })

    expect(hook.getGoal("s1")?.status).toBe("paused")
  })

  test("event without sessionID is ignored", async () => {
    const ctx = makePluginInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory })
    hook.setGoal("s1", "Ship it")

    await hook.event({ event: { type: "session.idle", properties: {} } })

    expect(hook.getGoal("s1")?.status).toBe("active")
  })
})

describe("goal continuation loop", () => {
  type Sent = { text: string }
  function loopInput(messages: unknown[] = []) {
    const sent: Sent[] = []
    const ctx = {
      directory: mkdtempSync(join(tmpdir(), "goal-loop-")),
      client: {
        session: {
          messages: async () => ({ data: messages }),
          promptAsync: async (input: { body: { parts: Array<{ text: string }> } }) => {
            sent.push({ text: input.body.parts[0]?.text ?? "" })
            return {}
          },
          prompt: async (input: { body: { parts: Array<{ text: string }> } }) => {
            sent.push({ text: input.body.parts[0]?.text ?? "" })
            return {}
          },
        },
      },
    } as unknown as PluginInput
    return { ctx, sent }
  }
  const idle = { event: { type: "session.idle", properties: { sessionID: "s1" } } }

  test("waits while a background task launched from the session still runs", async () => {
    const { ctx } = loopInput()
    let running = true
    const hook = createGoalHook(ctx, { projectDir: ctx.directory, hasActiveBackgroundTasks: () => running })
    hook.setGoal("s1", "Ship it")
    await hook.event(idle)
    expect(hook.getGoal("s1")?.turnsUsed).toBe(0)
    running = false
    await hook.event(idle)
    expect(hook.getGoal("s1")?.turnsUsed).toBe(1)
  })

  test("a continuation the gate still holds is not counted and is tried again shortly", async () => {
    const { ctx, sent } = loopInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory, retryDelayMs: 20, hasActiveBackgroundTasks: () => false })
    hook.setGoal("s1", "Ship it")
    await hook.event(idle)
    expect(hook.getGoal("s1")?.turnsUsed).toBe(1)
    await hook.event(idle)
    expect(hook.getGoal("s1")?.turnsUsed).toBe(1)
    releaseAllPromptAsyncReservationsForTesting()
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(hook.getGoal("s1")?.turnsUsed).toBe(2)
    expect(sent.length).toBe(2)
  })

  test("records the tokens the goal spent and stops when its budget is gone", async () => {
    const start = Math.trunc(Date.now() / 1000)
    const turn = (created: number, input: number) => ({
      info: { role: "assistant", time: { created, completed: created + 2000 }, tokens: { input, output: 100, cache: { read: 0 } } },
    })
    const { ctx } = loopInput([turn((start - 100) * 1000, 1000), turn((start + 1) * 1000, 5000)])
    const hook = createGoalHook(ctx, { projectDir: ctx.directory, hasActiveBackgroundTasks: () => false })
    hook.setGoal("s1", "Ship it")
    const controllerBudget = (await import("./controller")).createGoalController({ projectDir: ctx.directory })
    controllerBudget.setBudget("s1", 3000)
    await hook.event(idle)
    const goal = hook.getGoal("s1")
    expect(goal?.tokensUsed).toBe(4000)
    expect(goal?.timeUsedSeconds).toBe(2)
    expect(goal?.status).toBe("budgetLimited")
  })

  test("stops as blocked at the continuation cap, and resume grants a fresh allowance", async () => {
    const { ctx } = loopInput()
    const hook = createGoalHook(ctx, { projectDir: ctx.directory, maxTurns: 2, hasActiveBackgroundTasks: () => false })
    hook.setGoal("s1", "Ship it")
    await hook.event(idle)
    releaseAllPromptAsyncReservationsForTesting()
    await hook.event(idle)
    releaseAllPromptAsyncReservationsForTesting()
    expect(hook.getGoal("s1")?.status).toBe("active")
    await hook.event(idle)
    expect(hook.getGoal("s1")?.status).toBe("blocked")
    hook.resumeGoal("s1")
    expect(hook.getGoal("s1")).toMatchObject({ status: "active", turnsUsed: 0 })
  })
})
