import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { createGoalController } from "../hooks/goal/controller"
import { GoalFileSchema, type Goal } from "../hooks/goal/types"
import { log } from "../shared/logger"

/**
 * The goal driver id OMO declares to OpenChamber (`contributes.goal.driver`
 * of the openchamber-omo extension). A goal OpenChamber finds in
 * `metadata.openchamber.goal` with this driver is shown with its own goal UI
 * and left to OMO's loop.
 */
export const OMO_GOAL_DRIVER = "omo"

type Metadata = Record<string, unknown>

type SessionApi = {
  get: (input: { sessionID: string }) => Promise<unknown>
  update: (input: { sessionID: string; metadata: Metadata }) => Promise<unknown>
}

const isRecord = (value: unknown): value is Metadata => typeof value === "object" && value !== null && !Array.isArray(value)

/** OpenChamber's goal record for an OMO goal. OMO keeps seconds; OpenChamber milliseconds. */
export function goalMirror(goal: Goal): Metadata {
  return {
    id: goal.id,
    objective: goal.objective,
    objectiveFile: false,
    status: goal.status,
    tokenBudget: goal.tokenBudget ?? null,
    tokensUsed: goal.tokensUsed,
    turnsUsed: goal.turnsUsed,
    blockedStreak: 0,
    note: "",
    statusReason: goal.status === "blocked" ? "continuation limit reached" : goal.status === "budgetLimited" ? "token budget spent" : "",
    createdAt: goal.createdAt * 1000,
    updatedAt: goal.updatedAt * 1000,
    driver: OMO_GOAL_DRIVER,
  }
}

const MIRROR_KEYS = ["id", "objective", "status", "tokenBudget", "tokensUsed", "turnsUsed", "statusReason", "driver"] as const

const sameMirror = (left: unknown, right: Metadata): boolean => (
  isRecord(left) && MIRROR_KEYS.every((key) => (left[key] ?? null) === (right[key] ?? null))
)

function readGoals(projectDir: string): Map<string, Goal> {
  const goals = new Map<string, Goal>()
  const goalDir = join(projectDir, ".omo", "goal")
  if (!existsSync(goalDir)) return goals
  for (const name of readdirSync(goalDir)) {
    if (!name.endsWith(".json")) continue
    try {
      const goal = GoalFileSchema.parse(JSON.parse(readFileSync(join(goalDir, name), "utf8"))).goal
      if (goal) goals.set(goal.sessionID, goal)
    } catch {
      // A half-written or foreign file is skipped; the goal store rewrites atomically.
    }
  }
  return goals
}

const metadataOf = (session: unknown): Metadata => (isRecord(session) && isRecord(session.metadata) ? session.metadata : {})

const withGoal = (metadata: Metadata, goal: Metadata | null): Metadata => {
  const namespace = isRecord(metadata.openchamber) ? { ...metadata.openchamber } : {}
  if (goal) namespace.goal = goal
  else delete namespace.goal
  return { ...metadata, openchamber: namespace }
}

/**
 * Keeps OMO's `/goal` and OpenChamber's goal of the same session in step.
 *
 * - OMO → OpenChamber: every goal in `.omo/goal` is written to
 *   `metadata.openchamber.goal` with `driver: "omo"` whenever what it shows
 *   changed (status, objective, tokens, turns, budget).
 * - OpenChamber → OMO: a mirror the user changed in OpenChamber (it carries a
 *   newer `updatedAt` than OMO's goal) applies its status, objective and
 *   budget to OMO's goal. A mirror the user cleared, or replaced with an
 *   OpenChamber goal of its own, clears OMO's goal, so the two loops never
 *   run on one session.
 * - A goal cleared in OMO removes its mirror.
 *
 * OpenCode replaces session metadata as a whole, so each write is
 * read-modify-write on the current record.
 */
export function createGoalSync(input: { projectDir: string; session: SessionApi }): () => Promise<void> {
  const controller = createGoalController({ projectDir: input.projectDir })
  // Goal id last mirrored per session: a missing mirror means "cleared in
  // OpenChamber" only for a goal this process already mirrored.
  const mirrored = new Map<string, string>()
  // Sessions whose sync failed, so a deleted session is logged once, not every tick.
  const failing = new Set<string>()

  const write = async (sessionID: string, metadata: Metadata, goal: Metadata | null) => {
    await input.session.update({ sessionID, metadata: withGoal(metadata, goal) })
  }

  const applyUserChanges = (sessionID: string, goal: Goal, mirror: Metadata): Goal | null => {
    if (mirror.status !== goal.status) {
      if (mirror.status === "active") controller.resumeGoal(sessionID)
      else if (mirror.status === "paused") controller.pauseGoal(sessionID)
      else if (mirror.status === "complete") controller.markComplete(sessionID)
    }
    if (typeof mirror.objective === "string" && mirror.objective.trim() && mirror.objective.trim() !== goal.objective) {
      try {
        controller.updateObjective(sessionID, mirror.objective)
      } catch (error) {
        log("[oh-my-openagent] goal objective from OpenChamber refused", { sessionID, error: error instanceof Error ? error.message : String(error) })
      }
    }
    const budget = typeof mirror.tokenBudget === "number" && mirror.tokenBudget > 0 ? Math.floor(mirror.tokenBudget) : null
    if (budget !== (goal.tokenBudget ?? null)) controller.setBudget(sessionID, budget)
    return controller.getGoal(sessionID)
  }

  const syncSession = async (sessionID: string, current: Goal) => {
    const metadata = metadataOf(await input.session.get({ sessionID }))
    const namespace = isRecord(metadata.openchamber) ? metadata.openchamber : {}
    const mirror = isRecord(namespace.goal) ? namespace.goal : null
    let goal: Goal | null = current

    if (mirrored.get(sessionID) === goal.id && (!mirror || mirror.id !== goal.id)) {
      // Cleared in OpenChamber, or replaced by an OpenChamber goal: OMO steps aside.
      controller.clearGoal(sessionID)
      mirrored.delete(sessionID)
      return
    }
    if (mirror && mirror.id !== goal.id && mirror.driver !== OMO_GOAL_DRIVER) {
      // An OpenChamber goal was already there; OMO's /goal takes the session over.
      log("[oh-my-openagent] goal replaces the OpenChamber goal of the session", { sessionID })
    }
    if (mirror?.driver === OMO_GOAL_DRIVER && mirror.id === goal.id
      && typeof mirror.updatedAt === "number" && mirror.updatedAt > goal.updatedAt * 1000) {
      goal = applyUserChanges(sessionID, goal, mirror)
      if (!goal) return
    }

    const desired = goalMirror(goal)
    mirrored.set(sessionID, goal.id)
    if (sameMirror(mirror, desired)) return
    await write(sessionID, metadata, desired)
  }

  const unmirror = async (sessionID: string, goalID: string) => {
    const metadata = metadataOf(await input.session.get({ sessionID }))
    const mirror = isRecord(metadata.openchamber) && isRecord(metadata.openchamber.goal) ? metadata.openchamber.goal : null
    if (mirror?.driver === OMO_GOAL_DRIVER && mirror.id === goalID) await write(sessionID, metadata, null)
    mirrored.delete(sessionID)
  }

  return async () => {
    const goals = readGoals(input.projectDir)
    for (const [sessionID, goal] of goals) {
      await syncSession(sessionID, goal).then(
        () => { failing.delete(sessionID) },
        (error: unknown) => {
          if (failing.has(sessionID)) return
          failing.add(sessionID)
          log("[oh-my-openagent] goal sync failed", { sessionID, error: error instanceof Error ? error.message : String(error) })
        },
      )
    }
    for (const [sessionID, goalID] of [...mirrored]) {
      if (goals.has(sessionID)) continue
      await unmirror(sessionID, goalID).catch((error: unknown) => {
        log("[oh-my-openagent] goal unmirror failed", { sessionID, error: error instanceof Error ? error.message : String(error) })
      })
    }
  }
}
