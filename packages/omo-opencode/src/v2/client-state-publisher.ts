import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { TeamModeConfig } from "@oh-my-opencode/team-core/config"

import { listRegisteredBackgroundTasks, type BackgroundTaskControl } from "../features/background-agent/task-registry"
import type { BackgroundTask } from "../features/background-agent/types"
import { log } from "../shared/logger"
import { CLIENT_STATE_SCHEMA, processClientRequests, providerHealth } from "./client-control"
import { backgroundTasksByParent, configPathsOf, goalsBySession, plansBySession, teamRunsByLead } from "./client-state"

const META_INTERVAL_MS = 30_000
const SNAPSHOT_INTERVAL_MS = 5_000
const CONTROL_INTERVAL_MS = 1_500

function writeIfChanged(directory: string, name: string, value: Record<string, unknown>): boolean {
  const file = join(directory, name)
  const exists = existsSync(file)
  if (!exists && Object.keys(value).length === 0) return false
  const text = JSON.stringify(value)
  if (exists && readFileSync(file, "utf8") === text) return false
  mkdirSync(directory, { recursive: true })
  writeFileSync(file, text)
  return true
}

export function startClientStatePublisher(input: {
  readonly stateDirectory: string
  readonly teamMode?: TeamModeConfig
  readonly intervalMs?: number
  readonly owner: string
  readonly readTasks?: () => readonly BackgroundTask[]
  readonly categories?: Record<string, string[]>
  readonly control?: () => BackgroundTaskControl | undefined
  readonly onStateChanged?: () => Promise<void> | void
}): () => void {
  const readTasks = input.readTasks ?? (() => listRegisteredBackgroundTasks(input.owner))
  const snapshotIntervalMs = input.intervalMs ?? SNAPSHOT_INTERVAL_MS
  const configPaths = configPathsOf(input.owner)
  let running = false
  let stopped = false
  let publishedAt: number | undefined
  let metaAt = 0

  const publish = async () => {
    if (running || stopped) return
    running = true
    try {
      const requests = await processClientRequests(input.stateDirectory, input.control?.())
      if (stopped) return
      const now = Date.now()
      // Controls remain responsive without rescanning every location's files.
      if (requests === 0 && publishedAt !== undefined && now - publishedAt < snapshotIntervalMs) return
      const tasks = readTasks()
      const plans = plansBySession(input.owner)
      const goals = goalsBySession(input.owner)
      let changed = [
        writeIfChanged(input.stateDirectory, "background.json", backgroundTasksByParent(tasks)),
        writeIfChanged(input.stateDirectory, "plans.json", plans),
        writeIfChanged(input.stateDirectory, "goals.json", goals),
        writeIfChanged(input.stateDirectory, "health.json", { categories: input.categories ?? {}, providers: providerHealth(tasks, now) }),
      ].some(Boolean)
      if (now - metaAt >= META_INTERVAL_MS) {
        metaAt = now
        writeIfChanged(input.stateDirectory, "meta.json", { schema: CLIENT_STATE_SCHEMA, publishedAt: metaAt, heartbeatMs: META_INTERVAL_MS, ...configPaths })
      }
      if (input.teamMode?.enabled) {
        const teams = await teamRunsByLead(input.teamMode)
        if (stopped) return
        changed = writeIfChanged(input.stateDirectory, "teams.json", teams) || changed
      }
      if (changed) await input.onStateChanged?.()
      publishedAt = now
    } catch (error) {
      log("[oh-my-openagent] client state publish failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      running = false
    }
  }
  void publish()
  // Both clocks share the same serialization guard, including control refreshes.
  const snapshotTimer = setInterval(() => void publish(), snapshotIntervalMs)
  const controlTimer = setInterval(() => void publish(), CONTROL_INTERVAL_MS)
  snapshotTimer.unref?.()
  controlTimer.unref?.()
  return () => {
    stopped = true
    clearInterval(snapshotTimer)
    clearInterval(controlTimer)
  }
}
