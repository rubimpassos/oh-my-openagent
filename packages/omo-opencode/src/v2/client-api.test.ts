/// <reference types="bun-types" />
import { randomUUID } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { RpcHandlers } from "@opencode/plugin/promise/rpc"
import { afterEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { forgetBackgroundTask, rememberBackgroundTask, registerBackgroundTaskControl } from "../features/background-agent/task-registry"
import type { BackgroundTask } from "../features/background-agent/types"
import { createGoalController } from "../hooks/goal/controller"
import { syncGoalFromClient } from "../hooks/goal/sync-bridge"
import { startClientApi, type ClientApiOptions } from "./client-api"
import { clientRpc, continuationRpc } from "./client-api-contract"

type Handlers = RpcHandlers<typeof clientRpc>
type CallContext = Parameters<Handlers["describe"]>[1]
const context: CallContext = {
  signal: new AbortController().signal,
  error: () => { throw new Error("Unexpected RPC error") },
}
async function invoke<I extends z.ZodType, O extends z.ZodType>(
  method: { readonly input: I; readonly output: O },
  handler: (input: z.output<I>, context: CallContext) => Promise<z.input<O>>,
  input: unknown,
): Promise<z.output<O>> {
  return method.output.parse(await handler(method.input.parse(input), context))
}

const cleanup: Array<() => void | Promise<void>> = []
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose() })

async function fixture(goalEnabled = true) {
  const owner = mkdtempSync(join(tmpdir(), "omo-client-api-"))
  cleanup.push(() => rmSync(owner, { recursive: true, force: true }))
  const controller = createGoalController({ projectDir: owner })
  const goal = controller.setGoal("ses_main", "Deliver API")
  const events: Array<{ name: string; data: unknown }> = []
  let handlers: Handlers | undefined
  let removed = false
  let directory = owner
  let callback: (request: z.infer<ReturnType<typeof continuationRpc>["methods"]["beforeGoalContinuation"]["input"]>) => Promise<unknown> = async () => ({ synchronized: true })
  const rpc: ClientApiOptions["ctx"]["rpc"] = Object.assign(
    (definition: ReturnType<typeof continuationRpc>) => ({
      beforeGoalContinuation: async (request: z.infer<typeof definition.methods.beforeGoalContinuation.input>) => (
        definition.methods.beforeGoalContinuation.output.parse(await callback(definition.methods.beforeGoalContinuation.input.parse(request)))
      ),
    }),
    { register: async (_definition: typeof clientRpc, registered: Handlers) => {
      handlers = registered
      return {
        dispose: async () => { removed = true },
        events: { emit: async (name: "ready" | "stateChanged", data: { instanceID: string; revision: number }) => { events.push({ name, data }) } },
      }
    } },
  )
  const api = await startClientApi({
    owner, goalEnabled, ctx: { rpc, session: { get: async () => ({ location: { directory } }) } },
    categories: { quick: ["provider/model"] },
  })
  cleanup.push(api.dispose)
  if (!handlers) throw new Error("Client RPC was not registered")
  const registered = handlers
  const call = {
    describe: () => invoke(clientRpc.methods.describe, registered.describe, {}),
    getState: (request: unknown = {}) => invoke(clientRpc.methods.getState, registered.getState, request),
    controlGoal: (request: unknown) => invoke(clientRpc.methods.controlGoal, registered.controlGoal, request),
    controlTask: (request: unknown) => invoke(clientRpc.methods.controlTask, registered.controlTask, request),
    attach: (request: unknown) => invoke(clientRpc.methods.attach, registered.attach, request),
    detach: (request: unknown) => invoke(clientRpc.methods.detach, registered.detach, request),
  }
  const info = await call.describe()
  const attached = await call.attach({ instanceID: info.instanceID, clientID: "client", callbackRPCID: "companion.v1", presentation: { surface: "chat" } })
  if (!attached.ok) throw new Error(attached.error.message)
  return {
    api, call, owner, goal, controller, events, attachment: attached.attachment,
    removed: () => removed,
    move: () => { directory = "/another/location" },
    callback: (fn: typeof callback) => { callback = fn },
  }
}

describe("client API", () => {
  test("RPC registration exposes portable session snapshots and ordered revision events", async () => {
    // given
    const { api, call, controller, events } = await fixture()
    controller.setGoal("ses_other", "Other goal")
    // when
    await api.invalidate()
    const state = await call.getState({ sessionID: "ses_main" })
    // then
    expect(Object.keys(state.goals)).toEqual(["ses_main"])
    expect(state.goals.ses_main).toMatchObject({ sessionID: "ses_main", objective: "Deliver API" })
    expect(state.health.categories).toEqual({ quick: ["provider/model"] })
    expect(events).toEqual([
      { name: "ready", data: { instanceID: state.instanceID, revision: 0 } },
      { name: "stateChanged", data: { instanceID: state.instanceID, revision: 1 } },
      { name: "stateChanged", data: { instanceID: state.instanceID, revision: 2 } },
    ])
    expect(state.revision).toBe(2)
  })

  test("the continuation callback can reenter goal controls without a lock", async () => {
    // given
    const f = await fixture()
    f.callback(async (request) => {
      const result = await f.call.controlGoal({
        action: "update", sessionID: request.sessionID, expectedGoalID: request.expectedGoalID,
        attachment: request.attachment, status: "paused",
      })
      if (!result.ok) throw new Error(result.error.message)
      return { synchronized: true }
    })
    // when
    const guard = await syncGoalFromClient(f.owner, "ses_main", f.goal.id)
    // then
    expect(guard()).toBe(true)
    expect(f.controller.getGoal("ses_main")?.status).toBe("paused")
  }, 1000)

  test("detach invalidates late callback controls and guards while preserving the goal", async () => {
    // given
    const f = await fixture()
    const pending = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    let outcome: unknown
    f.callback(async (request) => {
      entered.resolve()
      await pending.promise
      outcome = await f.call.controlGoal({ action: "clear", sessionID: request.sessionID, expectedGoalID: request.expectedGoalID, attachment: request.attachment })
      return { synchronized: true }
    })
    const synchronization = syncGoalFromClient(f.owner, "ses_main", f.goal.id)
    await entered.promise
    // when
    const result = await f.call.detach(f.attachment)
    pending.resolve()
    const guard = await synchronization
    // then
    expect(result).toEqual({ detached: true })
    expect(outcome).toMatchObject({ ok: false, error: { code: "stale_attachment" } })
    expect(guard()).toBe(false)
    expect(f.api.surface()).toBe("terminal")
    expect(f.controller.getGoal("ses_main")).toEqual(f.goal)
  })

  test("dispose unregisters RPC and goal sync and invalidates returned guards", async () => {
    // given
    const f = await fixture()
    const guard = await syncGoalFromClient(f.owner, "ses_main", f.goal.id)
    f.callback(async () => { throw new Error("Disposed callback invoked") })
    // when
    await f.api.dispose()
    const next = await syncGoalFromClient(f.owner, "ses_main", f.goal.id)
    // then
    expect(f.removed()).toBe(true)
    expect(guard()).toBe(false)
    expect(next()).toBe(true)
    expect(f.api.surface()).toBe("terminal")
    expect(f.controller.getGoal("ses_main")).toEqual(f.goal)
  })

  test.each(["cancel", "retry", "moved", "stale", "unknown", "foreign", "unsupported"] as const)("task control routes %s through the owning manager", async (scenario) => {
    // given
    const f = await fixture()
    const task: BackgroundTask = {
      id: `bg_${randomUUID()}`, parentSessionId: "ses_main", parentMessageId: "msg",
      description: "Work", prompt: "Private work", agent: "worker", status: "running",
    }
    rememberBackgroundTask(task, scenario === "foreign" ? "/foreign/owner" : f.owner)
    cleanup.push(() => forgetBackgroundTask(task.id))
    const launched: string[] = []
    if (scenario !== "unsupported") registerBackgroundTaskControl(f.owner, {
      getTask: (id) => id === task.id ? task : undefined,
      cancelTask: async () => { task.status = "cancelled"; return true },
      launch: async (input) => { launched.push(input.prompt); return { ...task, id: "retried" } },
    })
    if (scenario === "moved") f.move()
    // when
    const result = await f.call.controlTask({
      action: scenario === "retry" ? "retry" : "cancel",
      taskId: scenario === "unknown" ? "foreign-task" : task.id,
      attachment: scenario === "stale" ? { ...f.attachment, generation: "old" } : f.attachment,
    })
    // then
    const accepted = scenario === "cancel" || scenario === "retry"
    const code = scenario === "unsupported" ? "unsupported" : scenario === "moved" ? "wrong_location" : scenario === "stale" ? "stale_attachment" : "not_found"
    expect(result).toMatchObject(accepted ? { ok: true } : { ok: false, error: { code } })
    expect(task.status).toBe(accepted ? "cancelled" : "running")
    expect(launched).toEqual(scenario === "retry" ? ["Private work"] : [])
    expect((await f.call.getState()).tasks.ses_main?.map((entry) => entry.id) ?? []).toEqual(scenario === "foreign" ? [] : [task.id])
  })

  test("RPC schema rejection and disabled goals cannot mutate controller state", async () => {
    // given
    const f = await fixture(false)
    // when / then
    const invalid = await f.call.controlGoal({ action: "clear", sessionID: "../escape", expectedGoalID: f.goal.id }).then(() => null, (error: unknown) => error)
    expect(invalid).toBeInstanceOf(z.ZodError)
    expect(await f.call.controlGoal({ action: "clear", sessionID: "ses_main", expectedGoalID: f.goal.id })).toMatchObject({ ok: false, error: { code: "unsupported" } })
    expect(f.controller.getGoal("ses_main")).toEqual(f.goal)
  })
})
