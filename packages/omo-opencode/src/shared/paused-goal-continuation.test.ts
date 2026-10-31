/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createGoalController } from "../hooks/goal/controller"
import { registerGoalSync } from "../hooks/goal/sync-bridge"
import { createGoalSync, goalMirror } from "../v2/goal-sync"
import { dispatchInternalPrompt, releaseAllPromptAsyncReservationsForTesting } from "./prompt-async-gate"

describe("paused goal autonomous dispatch", () => {
  let directory: string
  let unregister = () => {}
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "paused-goal-")) })
  afterEach(() => {
    unregister()
    releaseAllPromptAsyncReservationsForTesting()
    rmSync(directory, { recursive: true, force: true })
  })

  for (const source of ["todo-continuation-enforcer", "atlas", "goal:idle-continuation"]) {
    test(`${source} prevents dispatch when the persisted goal is paused`, async () => {
      // given
      const controller = createGoalController({ projectDir: directory })
      controller.setGoal("session", "Finish the task")
      controller.pauseGoal("session")
      let dispatched = 0
      // when
      const result = await dispatchInternalPrompt({
        mode: "async", source, sessionID: "session", settleMs: 0, queueBehavior: "defer",
        client: { session: { promptAsync: async () => { dispatched++; return {} } } },
        input: { path: { id: "session" }, query: { directory } },
      })
      // then
      expect({ status: result.status, dispatched }).toEqual({ status: "cancelled", dispatched: 0 })
    })
  }

  test("applies a UI pause after asynchronous session inspection before dispatch", async () => {
    // given
    const controller = createGoalController({ projectDir: directory })
    controller.setGoal("session", "Finish the task")
    unregister = registerGoalSync(directory, async () => { controller.pauseGoal("session") })
    let dispatched = 0
    // when
    const result = await dispatchInternalPrompt({
      mode: "async", source: "todo-continuation-enforcer", sessionID: "session", settleMs: 0,
      queueBehavior: "defer",
      client: { session: { promptAsync: async () => { dispatched++; return {} } } },
      input: { path: { id: "session" }, query: { directory } },
    })
    // then
    expect({ status: result.status, dispatched, goal: controller.getGoal("session")?.status })
      .toEqual({ status: "cancelled", dispatched: 0, goal: "paused" })
  })

  for (const goalState of ["absent", "active", "resumed"] as const) {
    test(`continues ordinary work when goal is ${goalState}`, async () => {
      // given
      const controller = createGoalController({ projectDir: directory })
      if (goalState !== "absent") controller.setGoal("session", "Finish the task")
      if (goalState === "resumed") { controller.pauseGoal("session"); controller.resumeGoal("session") }
      let dispatched = 0
      // when
      const result = await dispatchInternalPrompt({
        mode: "async", source: "todo-continuation-enforcer", sessionID: "session", settleMs: 0,
        queueBehavior: "defer",
        client: { session: { promptAsync: async () => { dispatched++; return {} } } },
        input: { path: { id: "session" }, query: { directory } },
      })
      // then
      expect({ status: result.status, dispatched }).toEqual({ status: "dispatched", dispatched: 1 })
    })
  }

  test("preserves background result delivery when a goal is paused", async () => {
    // given
    const controller = createGoalController({ projectDir: directory })
    controller.setGoal("session", "Finish the task")
    controller.pauseGoal("session")
    let dispatched = 0
    // when
    const result = await dispatchInternalPrompt({
      mode: "async", source: "background-notification", sessionID: "session", settleMs: 0,
      queueBehavior: "defer",
      client: { session: { promptAsync: async () => { dispatched++; return {} } } },
      input: { path: { id: "session" }, query: { directory } },
    })
    // then
    expect({ status: result.status, dispatched }).toEqual({ status: "dispatched", dispatched: 1 })
  })

  test("cancels an armed continuation when pause arrives during the final status read", async () => {
    // given
    const controller = createGoalController({ projectDir: directory })
    controller.setGoal("session", "Finish the task")
    let dispatched = 0
    // when
    const result = await dispatchInternalPrompt({
      mode: "async", source: "atlas", sessionID: "session", settleMs: 0, queueBehavior: "defer",
      client: { session: {
        status: async () => { controller.pauseGoal("session"); return {} },
        promptAsync: async () => { dispatched++; return {} },
      } },
      input: { path: { id: "session" }, query: { directory } },
    })
    // then
    expect({ status: result.status, dispatched }).toEqual({ status: "cancelled", dispatched: 0 })
  })

  test("retains a caller's final dispatch veto with an active goal", async () => {
    // given
    createGoalController({ projectDir: directory }).setGoal("session", "Finish the task")
    let dispatched = 0
    // when
    const result = await dispatchInternalPrompt({
      mode: "async", source: "atlas", sessionID: "session", settleMs: 0, queueBehavior: "defer",
      shouldDispatch: async () => false,
      client: { session: { promptAsync: async () => { dispatched++; return {} } } },
      input: { path: { id: "session" }, query: { directory } },
    })
    // then
    expect({ status: result.status, dispatched }).toEqual({ status: "cancelled", dispatched: 0 })
  })

  test("honors paused OpenChamber metadata through the real goal sync", async () => {
    // given
    const controller = createGoalController({ projectDir: directory })
    const goal = controller.setGoal("session", "Finish the task")
    let metadata: Record<string, unknown> = { openchamber: { goal: goalMirror(goal) } }
    const sync = createGoalSync({ projectDir: directory, session: {
      get: async () => ({ metadata }),
      update: async (input) => { metadata = input.metadata },
    } })
    await sync.session("session")
    metadata = { openchamber: { goal: { ...goalMirror(goal), status: "paused" } } }
    unregister = registerGoalSync(directory, sync.session)
    let dispatched = 0
    // when
    const result = await dispatchInternalPrompt({
      mode: "async", source: "atlas", sessionID: "session", settleMs: 0, queueBehavior: "defer",
      client: { session: { promptAsync: async () => { dispatched++; return {} } } },
      input: { path: { id: "session" }, query: { directory } },
    })
    // then
    expect({ status: result.status, dispatched, goal: controller.getGoal("session")?.status })
      .toEqual({ status: "cancelled", dispatched: 0, goal: "paused" })
  })

  test("resumes the same session after its paused dispatch was cancelled", async () => {
    // given
    const controller = createGoalController({ projectDir: directory })
    controller.setGoal("session", "Finish the task")
    controller.pauseGoal("session")
    let dispatched = 0
    const args = {
      mode: "async", source: "todo-continuation-enforcer", sessionID: "session", settleMs: 0,
      queueBehavior: "defer",
      client: { session: { promptAsync: async () => { dispatched++; return {} } } },
      input: { path: { id: "session" }, query: { directory } },
    } as const
    expect((await dispatchInternalPrompt(args)).status).toBe("cancelled")
    controller.resumeGoal("session")
    // when
    const result = await dispatchInternalPrompt(args)
    // then
    expect({ status: result.status, dispatched }).toEqual({ status: "dispatched", dispatched: 1 })
  })
})
