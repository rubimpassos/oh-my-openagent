import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

import {
  getBoulderWorks,
  getPlanChecklist,
  readBoulderState,
  resolveBoulderPlanPathForWork,
} from "@oh-my-opencode/boulder-state"
import type { TeamModeConfig } from "@oh-my-opencode/team-core/config"
import { resolveBaseDir } from "@oh-my-opencode/team-core/team-registry/paths"
import { loadRuntimeState } from "@oh-my-opencode/team-core/team-state-store/store"

import { listRegisteredBackgroundTasks } from "../features/background-agent/task-registry"
import type { BackgroundTask } from "../features/background-agent/types"
import { GoalFileSchema } from "../hooks/goal/types"
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
  /** `providerID/modelID` of the attempt running now (or that ran last). */
  model?: string
  /** One entry per model the task tried, oldest first; a retry adds one. */
  attempts?: ClientTaskAttempt[]
}

export type ClientTaskAttempt = {
  number: number
  status: string
  sessionID?: string
  model?: string
  error?: string
  startedAt?: number
  completedAt?: number
}

/** A Prometheus plan Atlas is executing (`/ulw-execute`), for every session that works on it. */
export type ClientPlan = {
  workId: string
  planName: string
  planPath: string
  status: string
  total: number
  completed: number
  nextTask?: string
  startedAt?: number
  tasks: Array<{ key: string; label: string; title: string; status: string; sessionID: string; agent?: string; category?: string }>
}

/** The `/goal` a session is pursuing (OMO's continuation loop). */
export type ClientGoal = {
  objective: string
  status: "active" | "paused" | "complete" | "blocked" | "budgetLimited"
  tokensUsed: number
  tokenBudget?: number
  turnsUsed: number
  timeUsedSeconds: number
  createdAt: number
  updatedAt: number
  completedAt?: number
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
      ...(modelOf(task.model) ? { model: modelOf(task.model) } : {}),
      ...(task.attempts && task.attempts.length > 0
        ? {
            attempts: task.attempts.map((attempt) => {
              const model = attempt.providerId && attempt.modelId ? `${attempt.providerId}/${attempt.modelId}` : undefined
              return {
                number: attempt.attemptNumber,
                status: attempt.status,
                ...(attempt.sessionId ? { sessionID: attempt.sessionId } : {}),
                ...(model ? { model } : {}),
                ...(attempt.error ? { error: attempt.error } : {}),
                ...(attempt.startedAt ? { startedAt: attempt.startedAt.getTime() } : {}),
                ...(attempt.completedAt ? { completedAt: attempt.completedAt.getTime() } : {}),
              }
            }),
          }
        : {}),
    }
    ;(byParent[task.parentSessionId] ??= []).push(entry)
  }
  for (const list of Object.values(byParent)) list.sort((left, right) => (left.startedAt ?? 0) - (right.startedAt ?? 0))
  return byParent
}

function modelOf(model: BackgroundTask["model"]): string | undefined {
  return model?.providerID && model.modelID ? `${model.providerID}/${model.modelID}` : undefined
}

const time = (value: string | undefined): number | undefined => {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

// boulder.json namespaces session ids by platform ("opencode:ses_..."); clients use the bare id.
const bareSessionID = (sessionID: string): string => sessionID.replace(/^[a-z][a-z0-9-]*:/, "")

export function plansBySession(directory: string): Record<string, ClientPlan> {
  const state = readBoulderState(directory)
  if (!state) return {}
  const bySession: Record<string, ClientPlan> = {}
  for (const work of getBoulderWorks(state)) {
    const planPath = resolveBoulderPlanPathForWork(directory, work)
    const checklist = getPlanChecklist(planPath)
    const startedAt = time(work.started_at)
    const plan: ClientPlan = {
      workId: work.work_id,
      planName: work.plan_name,
      planPath,
      status: work.status ?? "active",
      total: checklist.total,
      completed: checklist.completed,
      ...(checklist.nextTaskLabel ? { nextTask: checklist.nextTaskLabel } : {}),
      ...(startedAt ? { startedAt } : {}),
      tasks: Object.values(work.task_sessions ?? {}).map((task) => ({
        key: task.task_key,
        label: task.task_label,
        title: task.task_title,
        status: task.status ?? "running",
        sessionID: bareSessionID(task.session_id),
        ...(task.agent ? { agent: task.agent } : {}),
        ...(task.category ? { category: task.category } : {}),
      })),
    }
    // A completed work stays in boulder.json; only a session still on it shows it.
    for (const sessionID of work.session_ids.map(bareSessionID)) {
      const current = bySession[sessionID]
      if (!current || current.status !== "active") bySession[sessionID] = plan
    }
  }
  return bySession
}

export function goalsBySession(directory: string): Record<string, ClientGoal> {
  const goalDir = join(directory, ".omo", "goal")
  if (!existsSync(goalDir)) return {}
  const bySession: Record<string, ClientGoal> = {}
  for (const name of readdirSync(goalDir)) {
    if (!name.endsWith(".json")) continue
    try {
      const goal = GoalFileSchema.parse(JSON.parse(readFileSync(join(goalDir, name), "utf8"))).goal
      if (!goal) continue
      bySession[goal.sessionID] = {
        objective: goal.objective,
        status: goal.status,
        tokensUsed: goal.tokensUsed,
        ...(goal.tokenBudget !== undefined ? { tokenBudget: goal.tokenBudget } : {}),
        turnsUsed: goal.turnsUsed,
        timeUsedSeconds: goal.timeUsedSeconds,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        ...(goal.completedAt ? { completedAt: goal.completedAt } : {}),
      }
    } catch (error) {
      log("[oh-my-openagent] unreadable goal file skipped", { file: name, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return bySession
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

/**
 * Runs `task` every `intervalMs`, one run at a time. A run that takes longer
 * than `timeoutMs` is abandoned (logged) so a hung call cannot stop the loop.
 */
export function startSerialLoop(name: string, task: () => Promise<void>, intervalMs: number, timeoutMs: number): () => void {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        task(),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            log(`[oh-my-openagent] ${name} took longer than ${timeoutMs} ms; continuing`)
            resolve()
          }, timeoutMs)
          timer.unref?.()
        }),
      ])
    } catch (error) {
      log(`[oh-my-openagent] ${name} failed`, { error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (timer) clearTimeout(timer)
      running = false
    }
  }
  const interval = setInterval(() => void run(), intervalMs)
  interval.unref?.()
  return () => clearInterval(interval)
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
      writeIfChanged(input.stateDirectory, "plans.json", plansBySession(input.owner))
      writeIfChanged(input.stateDirectory, "goals.json", goalsBySession(input.owner))
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
