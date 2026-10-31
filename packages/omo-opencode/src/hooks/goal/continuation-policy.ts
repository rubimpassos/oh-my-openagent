import { join } from "node:path"
import { readGoal } from "./store"

export function isGoalPaused(projectDir: string, sessionID: string): boolean {
  return readGoal({ baseDir: join(projectDir, ".omo", "goal"), sessionID })?.status === "paused"
}
