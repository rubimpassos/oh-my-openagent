import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { z } from "zod"

import type { BackgroundTaskControl } from "../features/background-agent/task-registry"
import type { BackgroundTask } from "../features/background-agent/types"
import { log } from "../shared/logger"
import { clientRpc, type ClientApiFailure } from "./client-api-contract"

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
  clientRpc.methods.controlTask.input.options[0].omit({ attachment: true }).extend({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  }),
  clientRpc.methods.controlTask.input.options[1].omit({ attachment: true }).extend({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  }),
])
export type ClientRequest = z.infer<typeof RequestSchema>
export type ClientRequestResult = { ok: boolean; message: string; at: number; action: string; taskId: string }

const RESULTS_KEPT = 20

type TaskRequest = z.infer<typeof clientRpc.methods.controlTask.input>
type TaskResult = { readonly ok: true; readonly message: string } | (ClientApiFailure & { readonly message: string })

export async function runClientRequest(request: TaskRequest, control: BackgroundTaskControl, current: () => boolean = () => true): Promise<TaskResult> {
  if (!current()) return { ok: false, message: "Client attachment changed.", error: { code: "stale_attachment", message: "Client attachment changed." } }
  const task = control.getTask(request.taskId)
  if (!task) {
    const message = `Task ${request.taskId} is not known to this OMO instance.`
    return { ok: false, message, error: { code: "not_found", message } }
  }
  switch (request.action) {
    case "cancel": {
      const cancelled = await control.cancelTask(task.id, { source: "client", reason: "Cancelled by client" })
      const message = `"${task.description}" is not running.`
      return cancelled ? { ok: true, message: `Cancelled "${task.description}".` } : { ok: false, message, error: { code: "unsupported", message } }
    }
    case "retry":
      break
    default:
      request satisfies never
      throw new TypeError("Unknown client task action")
  }
  if (task.status === "running" || task.status === "pending") {
    await control.cancelTask(task.id, { source: "client", reason: "Retried by client" })
  }
  if (!current()) return { ok: false, message: "Client attachment changed.", error: { code: "stale_attachment", message: "Client attachment changed." } }
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
      ? await runClientRequest(parsed, control).catch((error: unknown) => ({ ok: false, message: error instanceof Error ? error.message : String(error) }))
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
