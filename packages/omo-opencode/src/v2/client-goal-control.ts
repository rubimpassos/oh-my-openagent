import { createGoalController } from "../hooks/goal/controller"
import { wakeGoal } from "../hooks/goal/sync-bridge"
import type { Goal } from "../hooks/goal/types"
import type { ClientGoalControl, ClientGoalControlResult } from "./client-api-contract"

export type ClientSessionReader = {
  readonly get: (input: { readonly sessionID: string }) => Promise<{
    readonly location: { readonly directory: string }
  }>
}

export function createClientGoalControl(input: {
  readonly owner: string
  readonly goalEnabled: boolean
  readonly session: ClientSessionReader
}) {
  const controller = createGoalController({ projectDir: input.owner })
  return async (request: ClientGoalControl, current: () => boolean = () => true): Promise<ClientGoalControlResult> => {
    if (!input.goalEnabled) return { ok: false, error: { code: "unsupported", message: "Goals are disabled." } }
    const session = await input.session.get({ sessionID: request.sessionID })
    if (!current()) return { ok: false, error: { code: "stale_attachment", message: "Client attachment changed." } }
    if (session.location.directory !== input.owner) {
      return { ok: false, error: { code: "wrong_location", message: "Session belongs to another location." } }
    }
    const goal = controller.getGoal(request.sessionID)
    if (!goal) return { ok: false, error: { code: "not_found", message: "Session has no goal." } }
    if (goal.id !== request.expectedGoalID) {
      return { ok: false, error: { code: "goal_changed", message: "Session goal changed." } }
    }
    switch (request.action) {
      case "clear":
        controller.clearGoal(request.sessionID)
        return { ok: true, goal: null }
      case "update": {
        let updated: Goal | null = goal
        if (request.objective !== undefined && request.objective !== goal.objective) {
          updated = controller.updateObjective(request.sessionID, request.objective)
        }
        if (request.tokenBudget !== undefined && request.tokenBudget !== (goal.tokenBudget ?? null)) {
          updated = controller.setBudget(request.sessionID, request.tokenBudget)
        }
        let resumed = false
        switch (request.status) {
          case "active":
            if (goal.status !== "active") {
              updated = controller.resumeGoal(request.sessionID)
              resumed = true
            }
            break
          case "paused":
            if (goal.status !== "paused") updated = controller.pauseGoal(request.sessionID)
            break
          case "complete":
            if (goal.status !== "complete") updated = controller.markComplete(request.sessionID)
            break
          case undefined:
            break
          default:
            request.status satisfies never
            throw new TypeError("Unknown client goal status")
        }
        if (resumed) queueMicrotask(() => {
          const latest = controller.getGoal(request.sessionID)
          if (current() && latest?.id === goal.id && latest.status === "active") wakeGoal(input.owner, request.sessionID)
        })
        return { ok: true, goal: updated }
      }
      default:
        request satisfies never
        throw new TypeError("Unknown client goal action")
    }
  }
}
