import { join } from "node:path"
import { readGoal } from "./store"

type ContinuationGuard = () => boolean
type GoalSync = (sessionID: string, expectedGoalID: string) => Promise<void | ContinuationGuard>

/** Location-scoped client synchronization and explicit resume wake. */
type Bridge = {
  sync?: GoalSync
  wake?: (sessionID: string) => void
}

const bridges = new Map<string, Bridge>()

const bridge = (projectDir: string): Bridge => {
  let entry = bridges.get(projectDir)
  if (!entry) {
    entry = {}
    bridges.set(projectDir, entry)
  }
  return entry
}

export function registerGoalSync(projectDir: string, sync: GoalSync): () => void {
  const entry = bridge(projectDir)
  entry.sync = sync
  return () => { if (entry.sync === sync) delete entry.sync }
}

export function registerGoalWake(projectDir: string, wake: (sessionID: string) => void): () => void {
  const entry = bridge(projectDir)
  entry.wake = wake
  return () => { if (entry.wake === wake) delete entry.wake }
}

/** The returned guard remains valid only for the same goal and client execution. */
export async function syncGoalFromClient(
  projectDir: string,
  sessionID: string,
  expectedGoalID?: string,
): Promise<ContinuationGuard> {
  const ref = { baseDir: join(projectDir, ".omo", "goal"), sessionID }
  const goalID = expectedGoalID ?? readGoal(ref)?.id
  const sync = bridges.get(projectDir)?.sync
  const current = goalID ? await sync?.(sessionID, goalID) : undefined
  return () => bridges.get(projectDir)?.sync === sync
    && readGoal(ref)?.id === goalID
    && (typeof current !== "function" || current())
}

/** Lets the loop continue a goal the user resumed; a no-op without a loop. */
export function wakeGoal(projectDir: string, sessionID: string): void {
  bridges.get(projectDir)?.wake?.(sessionID)
}
