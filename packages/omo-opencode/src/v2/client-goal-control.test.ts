import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"
import { createGoalController } from "../hooks/goal/controller"
import { registerGoalWake } from "../hooks/goal/sync-bridge"
import { ClientGoalControlSchema } from "./client-api-contract"
import { createClientGoalControl, type ClientSessionReader } from "./client-goal-control"

const cleanup: Array<() => void> = []
afterEach(() => { for (const dispose of cleanup.splice(0).reverse()) dispose() })

function fixture() {
  const owner = mkdtempSync(join(tmpdir(), "omo-client-goal-"))
  cleanup.push(() => rmSync(owner, { recursive: true, force: true }))
  const controller = createGoalController({ projectDir: owner })
  const goal = controller.setGoal("ses_goal", "Original objective")
  const session: ClientSessionReader = { get: async () => ({ location: { directory: owner } }) }
  const control = createClientGoalControl({ owner, goalEnabled: true, session })
  return { owner, controller, goal, session, control }
}

describe("client goal control", () => {
  test("a compound resume persists objective and budget before waking the real controller", async () => {
    // given
    const { owner, controller, goal, control } = fixture()
    controller.noteContinuation("ses_goal")
    controller.pauseGoal("ses_goal")
    const observed: unknown[] = []
    cleanup.push(registerGoalWake(owner, () => { observed.push(controller.getGoal("ses_goal")) }))
    // when
    const result = await control(ClientGoalControlSchema.parse({
      action: "update", sessionID: "ses_goal", expectedGoalID: goal.id,
      objective: "  Updated objective  ", tokenBudget: 3000, status: "active",
    }))
    // then
    expect(result).toMatchObject({ ok: true, goal: { id: goal.id, objective: "Updated objective", tokenBudget: 3000, status: "active", turnsUsed: 0 } })
    expect(observed).toMatchObject([{ id: goal.id, objective: "Updated objective", tokenBudget: 3000, status: "active", turnsUsed: 0 }])
    expect(observed).toHaveLength(1)
  })

  test("resuming an active goal preserves continuation accounting and stored bytes", async () => {
    // given
    const { owner, controller, goal, control } = fixture()
    controller.noteContinuation("ses_goal")
    const file = join(owner, ".omo", "goal", "ses_goal.json")
    const before = readFileSync(file, "utf8")
    const wake: string[] = []
    cleanup.push(registerGoalWake(owner, (id) => { wake.push(id) }))
    // when
    const result = await control({ action: "update", sessionID: "ses_goal", expectedGoalID: goal.id, status: "active" })
    // then
    expect(result).toMatchObject({ ok: true, goal: { turnsUsed: 1 } })
    expect(readFileSync(file, "utf8")).toBe(before)
    expect(wake).toEqual([])
  })

  test.each(["paused", "complete"] as const)("status %s and budget removal use controller persistence", async (status) => {
    // given
    const { controller, goal, control } = fixture()
    controller.setBudget("ses_goal", 100)
    // when
    const result = await control({ action: "update", sessionID: "ses_goal", expectedGoalID: goal.id, status, tokenBudget: null })
    // then
    expect(result).toMatchObject({ ok: true, goal: { status } })
    expect(controller.getGoal("ses_goal")?.tokenBudget).toBeUndefined()
    expect(controller.getGoal("ses_goal")?.status).toBe(status)
  })

  test("clearing a goal preserves the controller mirror contract without waking", async () => {
    // given
    const { owner, controller, goal, control } = fixture()
    const wake: string[] = []
    cleanup.push(registerGoalWake(owner, (id) => { wake.push(id) }))
    // when
    const result = await control({ action: "clear", sessionID: "ses_goal", expectedGoalID: goal.id })
    // then
    expect(result).toEqual({ ok: true, goal: null })
    expect(controller.getGoal("ses_goal")).toBeNull()
    expect(JSON.parse(readFileSync(join(owner, ".omo", "ulw-loop", "ses_goal", "goals.json"), "utf8")).goals).toEqual([])
    expect(wake).toEqual([])
  })

  test.each(["disabled", "moved", "changed", "missing", "detached"] as const)("refuses %s mutations without altering stored state", async (condition) => {
    // given
    const { owner, controller, goal } = fixture()
    const control = createClientGoalControl({
      owner, goalEnabled: condition !== "disabled",
      session: { get: async () => ({ location: { directory: condition === "moved" ? "/other" : owner } }) },
    })
    const sessionID = condition === "missing" ? "ses_missing" : "ses_goal"
    const code = { disabled: "unsupported", moved: "wrong_location", changed: "goal_changed", missing: "not_found", detached: "stale_attachment" }[condition]
    // when
    const result = await control({
      action: "clear", sessionID, expectedGoalID: condition === "changed" ? "old-goal" : goal.id,
    }, () => condition !== "detached")
    // then
    expect(result).toMatchObject({ ok: false, error: { code } })
    expect(controller.getGoal("ses_goal")).toEqual(goal)
  })

  test("a goal replaced during awaited location lookup cannot receive the old mutation", async () => {
    // given
    const { owner, controller, goal } = fixture()
    const pending = Promise.withResolvers<{ location: { directory: string } }>()
    const control = createClientGoalControl({ owner, goalEnabled: true, session: { get: () => pending.promise } })
    // when
    const result = control({ action: "clear", sessionID: "ses_goal", expectedGoalID: goal.id })
    const replacement = controller.setGoal("ses_goal", "New goal")
    pending.resolve({ location: { directory: owner } })
    // then
    expect(await result).toMatchObject({ ok: false, error: { code: "goal_changed" } })
    expect(controller.getGoal("ses_goal")).toEqual(replacement)
  })
})
