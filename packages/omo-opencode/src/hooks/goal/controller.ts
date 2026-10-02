import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { clearGoal, createGoal, readGoal, updateGoal } from "./store"
import type { Goal, GoalStatus, TokenUsageSnapshot } from "./types"
import { validateObjective } from "./validation"

export type GoalControllerOptions = {
  readonly projectDir: string
}

export type TuiLoopSnapshot = {
  readonly version: 1
  readonly activeGoalId: string | undefined
  readonly goals: readonly {
    readonly id: string
    readonly title: string
    readonly status: "in_progress" | "complete"
    readonly successCriteria: readonly []
  }[]
}

export type GoalController = ReturnType<typeof createGoalController>

export function createGoalController(options: GoalControllerOptions) {
  const { projectDir } = options
  const baseDir = join(projectDir, ".omo", "goal")

  const storeRef = (sessionID: string) => ({ baseDir, sessionID })
  const tuiMirrorPath = (sessionID: string) =>
    join(projectDir, ".omo", "ulw-loop", sessionID, "goals.json")

  const writeTuiMirror = (sessionID: string, goal: Goal | null): void => {
    const path = tuiMirrorPath(sessionID)
    const snapshot: TuiLoopSnapshot = {
      version: 1,
      activeGoalId: goal?.id,
      goals: goal === null
        ? []
        : [{
            id: goal.id,
            title: goal.objective,
            status: goalStatusForTui(goal.status),
            successCriteria: [],
          }],
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8")
  }

  return {
    setGoal(sessionID: string, rawObjective: string): Goal {
      const objective = validateObjective(rawObjective)
      const ref = storeRef(sessionID)
      clearGoal(ref)
      const goal = createGoal(ref, objective)
      writeTuiMirror(sessionID, goal)
      return goal
    },

    getGoal(sessionID: string): Goal | null {
      return readGoal(storeRef(sessionID))
    },

    pauseGoal(sessionID: string): Goal | null {
      const goal = updateGoal(storeRef(sessionID), { status: "paused" })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    resumeGoal(sessionID: string): Goal | null {
      // An explicit resume grants a fresh continuation allowance, so a goal
      // stopped at the cap does not stop again on the next idle.
      const goal = updateGoal(storeRef(sessionID), { status: "active", turnsUsed: 0 })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    clearGoal(sessionID: string): boolean {
      const ref = storeRef(sessionID)
      const existed = readGoal(ref) !== null
      clearGoal(ref)
      writeTuiMirror(sessionID, null)
      return existed
    },

    markComplete(sessionID: string): Goal | null {
      const goal = updateGoal(storeRef(sessionID), { status: "complete" })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    /** Change the objective of the current goal, keeping its id and accounting. */
    updateObjective(sessionID: string, rawObjective: string): Goal | null {
      const goal = updateGoal(storeRef(sessionID), { objective: validateObjective(rawObjective) })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    /** Set or remove (`null`) the token budget. */
    setBudget(sessionID: string, tokenBudget: number | null): Goal | null {
      return updateGoal(storeRef(sessionID), { tokenBudget })
    },

    /** Stop an active goal at a limit: `blocked` (continuation cap) or `budgetLimited`. */
    settle(sessionID: string, status: "blocked" | "budgetLimited"): Goal | null {
      const goal = updateGoal(storeRef(sessionID), { status })
      if (goal !== null) writeTuiMirror(sessionID, goal)
      return goal
    },

    /** Record what the session spent since the goal started (absolute totals, idempotent). */
    recordUsage(sessionID: string, usage: { tokensUsed: number; timeUsedSeconds: number }): Goal | null {
      const goal = readGoal(storeRef(sessionID))
      if (goal === null) return null
      if (usage.tokensUsed <= goal.tokensUsed && usage.timeUsedSeconds <= goal.timeUsedSeconds) return goal
      return updateGoal(storeRef(sessionID), {
        tokensUsed: Math.max(goal.tokensUsed, usage.tokensUsed),
        timeUsedSeconds: Math.max(goal.timeUsedSeconds, usage.timeUsedSeconds),
      })
    },

    /** Count one continuation sent for the goal. */
    noteContinuation(sessionID: string): Goal | null {
      const goal = readGoal(storeRef(sessionID))
      return goal === null ? null : updateGoal(storeRef(sessionID), { turnsUsed: goal.turnsUsed + 1 })
    },

    accountUsage(sessionID: string, usage: TokenUsageSnapshot, elapsedSeconds: number): Goal | null {
      const ref = storeRef(sessionID)
      const goal = readGoal(ref)
      if (goal === null || goal.status !== "active") {
        return goal
      }
      const tokenDelta = Math.max(0, usage.input) + Math.max(0, usage.output)
      const updated = updateGoal(ref, {
        tokensUsed: goal.tokensUsed + tokenDelta,
        timeUsedSeconds: goal.timeUsedSeconds + Math.max(0, elapsedSeconds),
      })
      if (updated !== null) writeTuiMirror(sessionID, updated)
      return updated
    },

    updateTui(sessionID: string): void {
      writeTuiMirror(sessionID, readGoal(storeRef(sessionID)))
    },
  }
}

export function goalStatusForTui(status: GoalStatus): "in_progress" | "complete" {
  return status === "complete" ? "complete" : "in_progress"
}
