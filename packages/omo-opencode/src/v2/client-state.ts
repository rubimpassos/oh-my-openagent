import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

import type { TeamModeConfig } from "@oh-my-opencode/team-core/config"
import { resolveBaseDir } from "@oh-my-opencode/team-core/team-registry/paths"
import { loadRuntimeState } from "@oh-my-opencode/team-core/team-state-store/store"

import { listRegisteredBackgroundTasks } from "../features/background-agent/task-registry"
import type { BackgroundTask } from "../features/background-agent/types"
import { log } from "../shared/logger"

// Clients such as the OpenChamber extension read these files from
// `<project>/.omo/v2-state/`, keyed by the session that owns the work.
export type ClientBackgroundTask = {
  id: string
  description: string
  agent: string
  status: BackgroundTask["status"]
  sessionID?: string
  category?: string
  startedAt?: number
  completedAt?: number
  error?: string
  toolCalls?: number
  lastTool?: string
}

export type ClientTeamRun = {
  teamRunId: string
  teamName: string
  status: string
  members: Array<{ name: string; sessionID?: string; status: string; agentType: string }>
}

const RETIRED_TEAM_STATUSES = new Set(["deleted", "failed", "deleting"])

export function backgroundTasksByParent(tasks: readonly BackgroundTask[]): Record<string, ClientBackgroundTask[]> {
  const byParent: Record<string, ClientBackgroundTask[]> = {}
  for (const task of tasks) {
    if (!task.parentSessionId) continue
    const entry: ClientBackgroundTask = {
      id: task.id,
      description: task.description,
      agent: task.agent,
      status: task.status,
      ...(task.sessionId ? { sessionID: task.sessionId } : {}),
      ...(task.category ? { category: task.category } : {}),
      ...(task.startedAt ? { startedAt: task.startedAt.getTime() } : {}),
      ...(task.completedAt ? { completedAt: task.completedAt.getTime() } : {}),
      ...(task.error ? { error: task.error } : {}),
      ...(task.progress ? { toolCalls: task.progress.toolCalls } : {}),
      ...(task.progress?.lastTool ? { lastTool: task.progress.lastTool } : {}),
    }
    ;(byParent[task.parentSessionId] ??= []).push(entry)
  }
  for (const list of Object.values(byParent)) list.sort((left, right) => (left.startedAt ?? 0) - (right.startedAt ?? 0))
  return byParent
}

export async function teamRunsByLead(config: TeamModeConfig): Promise<Record<string, ClientTeamRun[]>> {
  const runtimeDir = join(resolveBaseDir(config), "runtime")
  if (!existsSync(runtimeDir)) return {}
  const byLead: Record<string, ClientTeamRun[]> = {}
  for (const entry of await readdir(runtimeDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const run = await loadRuntimeState(entry.name, config).catch(() => undefined)
    if (!run?.leadSessionId || RETIRED_TEAM_STATUSES.has(run.status)) continue
    ;(byLead[run.leadSessionId] ??= []).push({
      teamRunId: run.teamRunId,
      teamName: run.teamName,
      status: run.status,
      members: run.members.map((member) => ({
        name: member.name,
        ...(member.sessionId ? { sessionID: member.sessionId } : {}),
        status: member.status,
        agentType: member.agentType,
      })),
    })
  }
  return byLead
}

function writeIfChanged(directory: string, name: string, value: Record<string, unknown>): void {
  const file = join(directory, name)
  const exists = existsSync(file)
  if (!exists && Object.keys(value).length === 0) return
  const text = JSON.stringify(value)
  if (exists && readFileSync(file, "utf8") === text) return
  mkdirSync(directory, { recursive: true })
  writeFileSync(file, text)
}

export function startClientStatePublisher(input: {
  stateDirectory: string
  teamMode?: TeamModeConfig
  intervalMs?: number
  owner: string
  readTasks?: () => readonly BackgroundTask[]
}): () => void {
  const readTasks = input.readTasks ?? (() => listRegisteredBackgroundTasks(input.owner))
  let running = false
  const publish = async () => {
    if (running) return
    running = true
    try {
      writeIfChanged(input.stateDirectory, "background.json", backgroundTasksByParent(readTasks()))
      if (input.teamMode?.enabled) {
        writeIfChanged(input.stateDirectory, "teams.json", await teamRunsByLead(input.teamMode))
      }
    } catch (error) {
      log("[oh-my-openagent] client state publish failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      running = false
    }
  }
  void publish()
  const timer = setInterval(() => void publish(), input.intervalMs ?? 1500)
  timer.unref?.()
  return () => clearInterval(timer)
}
