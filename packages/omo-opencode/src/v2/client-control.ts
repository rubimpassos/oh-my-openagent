import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { z } from "zod"

import type { BackgroundTaskControl } from "../features/background-agent/task-registry"
import type { BackgroundTask } from "../features/background-agent/types"
import { log } from "../shared/logger"

/**
 * Version of the `.omo/v2-state` files. A client that needs a newer one tells
 * the user to update the plugin instead of showing empty lists.
 */
export const CLIENT_STATE_SCHEMA = 2

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

// --- model health ------------------------------------------------------------

export type ClientHealth = {
  /** Each category's model chain: the first model, then its fallbacks. */
  categories: Record<string, string[]>
  /** Providers whose background attempts failed recently, worst first. */
  providers: Array<{ provider: string; failures: number; lastError: string; lastModel: string; lastAt: number }>
}

const HEALTH_WINDOW_MS = 60 * 60 * 1000

/** `categories` as configured: `models` (string or `{ model }`), else the deprecated `model` + `fallback_models`. */
export function categoryModels(categories: unknown): Record<string, string[]> {
  if (!isRecord(categories)) return {}
  const result: Record<string, string[]> = {}
  for (const [name, value] of Object.entries(categories)) {
    if (!isRecord(value) || value.disable === true) continue
    const entry = (item: unknown): string | undefined => (typeof item === "string" ? item : isRecord(item) && typeof item.model === "string" ? item.model : undefined)
    const chain = Array.isArray(value.models)
      ? value.models.map(entry)
      : [entry(value.model), ...(Array.isArray(value.fallback_models) ? value.fallback_models.map(entry) : [entry(value.fallback_models)])]
    const models = chain.filter((model): model is string => Boolean(model))
    if (models.length > 0) result[name] = models
  }
  return result
}

/** Failed background attempts of the last hour, grouped by provider. */
export function providerHealth(tasks: readonly BackgroundTask[], now: number): ClientHealth["providers"] {
  const byProvider = new Map<string, ClientHealth["providers"][number]>()
  for (const task of tasks) {
    for (const attempt of task.attempts ?? []) {
      if (attempt.status !== "error" || !attempt.providerId) continue
      const at = (attempt.completedAt ?? attempt.startedAt)?.getTime() ?? 0
      if (now - at > HEALTH_WINDOW_MS) continue
      const current = byProvider.get(attempt.providerId)
      const model = `${attempt.providerId}/${attempt.modelId ?? "?"}`
      if (!current) {
        byProvider.set(attempt.providerId, { provider: attempt.providerId, failures: 1, lastError: attempt.error ?? "error", lastModel: model, lastAt: at })
        continue
      }
      current.failures += 1
      if (at >= current.lastAt) Object.assign(current, { lastError: attempt.error ?? current.lastError, lastModel: model, lastAt: at })
    }
  }
  return [...byProvider.values()].sort((left, right) => right.failures - left.failures || right.lastAt - left.lastAt)
}

// --- requests from clients ---------------------------------------------------

/**
 * A client asks for an action by writing `requests/<id>.json` next to the
 * state files; the plugin runs it, deletes the file and records the outcome in
 * `results.json`. Only these actions exist, on tasks of this plugin instance.
 */
const RequestSchema = z.discriminatedUnion("action", [
  z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), action: z.literal("cancel"), taskId: z.string().min(1).max(128) }),
  z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    action: z.literal("retry"),
    taskId: z.string().min(1).max(128),
    /** `provider/model`; absent retries on the model the task last used. */
    model: z.string().regex(/^[^/\s]+\/\S+$/).max(200).optional(),
  }),
])
export type ClientRequest = z.infer<typeof RequestSchema>
export type ClientRequestResult = { ok: boolean; message: string; at: number; action: string; taskId: string }

const RESULTS_KEPT = 20

async function runRequest(request: ClientRequest, control: BackgroundTaskControl): Promise<{ ok: boolean; message: string }> {
  const task = control.getTask(request.taskId)
  if (!task) return { ok: false, message: `Task ${request.taskId} is not known to this OMO instance.` }
  if (request.action === "cancel") {
    const cancelled = await control.cancelTask(task.id, { source: "openchamber", reason: "Cancelled from the Oh-My-OpenAgent panel" })
    return cancelled ? { ok: true, message: `Cancelled "${task.description}".` } : { ok: false, message: `"${task.description}" is not running.` }
  }
  if (task.status === "running" || task.status === "pending") {
    await control.cancelTask(task.id, { source: "openchamber", reason: "Retried from the Oh-My-OpenAgent panel" })
  }
  const [providerID, ...rest] = (request.model ?? (task.model ? `${task.model.providerID}/${task.model.modelID}` : "")).split("/")
  const modelID = rest.join("/")
  const retried = await control.launch({
    description: task.description,
    prompt: task.prompt,
    agent: task.agent,
    parentSessionId: task.parentSessionId,
    parentMessageId: task.parentMessageId,
    ...(task.category ? { category: task.category } : {}),
    ...(task.skillContent ? { skillContent: task.skillContent } : {}),
    ...(task.fallbackChain ? { fallbackChain: task.fallbackChain } : {}),
    ...(task.parentModel ? { parentModel: task.parentModel } : {}),
    ...(task.parentAgent ? { parentAgent: task.parentAgent } : {}),
    ...(task.parentTools ? { parentTools: task.parentTools } : {}),
    ...(task.sessionPermission ? { sessionPermission: task.sessionPermission } : {}),
    ...(providerID && modelID ? { model: { providerID, modelID } } : {}),
  })
  return { ok: true, message: `Retrying "${task.description}"${providerID && modelID ? ` on ${providerID}/${modelID}` : ""} as ${retried.id}.` }
}

/** Runs and removes every pending request file; returns how many ran. */
export async function processClientRequests(stateDirectory: string, control: BackgroundTaskControl | undefined): Promise<number> {
  const requestDirectory = join(stateDirectory, "requests")
  if (!existsSync(requestDirectory)) return 0
  const resultsFile = join(stateDirectory, "results.json")
  let ran = 0
  for (const name of readdirSync(requestDirectory)) {
    if (!name.endsWith(".json")) continue
    const file = join(requestDirectory, name)
    let parsed: ClientRequest | undefined
    try {
      parsed = RequestSchema.parse(JSON.parse(readFileSync(file, "utf8")))
    } catch {
      parsed = undefined
    }
    try { unlinkSync(file) } catch { /* another instance took it */ continue }
    if (!parsed) continue
    const outcome = control
      ? await runRequest(parsed, control).catch((error: unknown) => ({ ok: false, message: error instanceof Error ? error.message : String(error) }))
      : { ok: false, message: "No background manager is running in this project." }
    log("[oh-my-openagent] client request", { action: parsed.action, taskId: parsed.taskId, ok: outcome.ok })
    let results: Record<string, ClientRequestResult> = {}
    try { results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) as Record<string, ClientRequestResult> : {} } catch { results = {} }
    results[parsed.id] = { ...outcome, at: Date.now(), action: parsed.action, taskId: parsed.taskId }
    const kept = Object.entries(results).sort(([, left], [, right]) => right.at - left.at).slice(0, RESULTS_KEPT)
    mkdirSync(stateDirectory, { recursive: true })
    writeFileSync(resultsFile, JSON.stringify(Object.fromEntries(kept)))
    ran += 1
  }
  return ran
}

// --- native notifications ----------------------------------------------------

export type Notice = { title: string; body: string; sessionId?: string; tag: string }

/**
 * OpenChamber's notification route for plugins in the OpenCode it manages
 * (`POST /api/notifications/emit`, bearer = the agent-tool token in this
 * process's environment). Without that environment nothing is sent.
 */
export function createNotifier(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): ((notice: Notice) => Promise<void>) | undefined {
  const endpoint = env.OPENCHAMBER_AGENT_TOOL_URL
  const token = env.OPENCHAMBER_AGENT_TOOL_TOKEN
  if (!endpoint || !token || !URL.canParse(endpoint)) return undefined
  const url = `${new URL(endpoint).origin}/api/notifications/emit`
  return async (notice) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: notice.title.slice(0, 120), body: notice.body.slice(0, 500), tag: notice.tag.slice(0, 128), ...(notice.sessionId ? { sessionId: notice.sessionId } : {}) }),
    }).catch(() => undefined)
    if (response && !response.ok) log("[oh-my-openagent] notification refused", { status: response.status })
  }
}

type Snapshot = {
  tasks: Map<string, { status: string; description: string; parent: string; error?: string }>
  goals: Map<string, string>
  plans: Map<string, { completed: number; total: number; name: string }>
}

const TERMINAL = new Set(["completed", "error", "cancelled", "interrupt"])

/**
 * What changed since the last look that the user would want to hear about
 * with OpenChamber in the background: a failed task, all of a session's
 * tasks finishing, a plan completing, a goal settling. The first look only
 * records the state.
 */
export function createTransitionWatcher() {
  let previous: Snapshot | undefined
  return (current: Snapshot): Notice[] => {
    const before = previous
    previous = current
    if (!before) return []
    const notices: Notice[] = []
    const finishedParents = new Set<string>()
    for (const [id, task] of current.tasks) {
      const was = before.tasks.get(id)
      if (!was || was.status === task.status || !TERMINAL.has(task.status) || TERMINAL.has(was.status)) continue
      finishedParents.add(task.parent)
      if (task.status === "error") {
        notices.push({ title: "Background task failed", body: `${task.description}${task.error ? `: ${task.error}` : ""}`, sessionId: task.parent, tag: `omo-task-${id}` })
      }
    }
    for (const parent of finishedParents) {
      const siblings = [...current.tasks.values()].filter((task) => task.parent === parent)
      if (siblings.every((task) => TERMINAL.has(task.status))) {
        const failed = siblings.filter((task) => task.status === "error").length
        notices.push({
          title: failed > 0 ? "Background tasks finished with failures" : "Background tasks complete",
          body: `${siblings.length - failed} of ${siblings.length} finished${failed > 0 ? `, ${failed} failed` : ""}.`,
          sessionId: parent,
          tag: `omo-tasks-${parent}`,
        })
      }
    }
    for (const [session, plan] of current.plans) {
      const was = before.plans.get(session)
      if (plan.total > 0 && plan.completed === plan.total && was && was.completed < was.total) {
        notices.push({ title: "Plan complete", body: plan.name, sessionId: session, tag: `omo-plan-${session}` })
      }
    }
    for (const [session, status] of current.goals) {
      const was = before.goals.get(session)
      if (!was || was === status || was !== "active") continue
      const title = status === "complete" ? "Goal complete" : status === "blocked" ? "Goal stopped at its continuation limit" : status === "budgetLimited" ? "Goal stopped: token budget spent" : ""
      if (title) notices.push({ title, body: "Oh-My-OpenAgent goal", sessionId: session, tag: `omo-goal-${session}` })
    }
    return notices
  }
}

export function snapshotOf(input: {
  tasks: readonly BackgroundTask[]
  goals: Record<string, { status: string }>
  plans: Record<string, { completed: number; total: number; planName: string }>
}): Snapshot {
  return {
    tasks: new Map(input.tasks.map((task) => [task.id, {
      status: task.status,
      description: task.description,
      parent: task.parentSessionId,
      ...(task.error ? { error: task.error } : {}),
    }])),
    goals: new Map(Object.entries(input.goals).map(([session, goal]) => [session, goal.status])),
    plans: new Map(Object.entries(input.plans).map(([session, plan]) => [session, { completed: plan.completed, total: plan.total, name: plan.planName }])),
  }
}
