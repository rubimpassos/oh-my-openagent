import type { Plugin } from "@opencode/plugin"

import { log } from "../shared/logger"
import { setVersionCache } from "../shared/opencode-version"
import { validatePluginConfig } from "../config/validate"
import { createAdapterState } from "./adapter-state"
import { startClientStatePublisher, startSerialLoop } from "./client-state"
import { createV1PluginInput } from "./context-facade"
import { registerV1Hooks, type V1HookMap } from "./hook-bridge"
import { createGoalSync } from "./goal-sync"
import { serveOrigin } from "./catalog"
import { getSessionRecord, listenPortOf, patchSessionMetadata } from "./serve-http"
import { projectV1Surface } from "./project-config"

type V1Server = (input: never, options: unknown) => Promise<V1HookMap>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export async function setupOpenCodeV2(
  ctx: Plugin.Context,
  deps: {
    server: V1Server
    agentDirectory?: string
  },
): Promise<(() => Promise<void> | void) | void> {
  if (typeof ctx.app.version === "string" && ctx.app.version.length > 0) setVersionCache(ctx.app.version)
  const state = createAdapterState(`${ctx.location.directory}/.omo/v2-state`)
  const v1Input = createV1PluginInput(ctx, { state })
  let hooks: V1HookMap
  try {
    hooks = await deps.server(v1Input as never, ctx.options)
  } catch (error) {
    log("[oh-my-openagent] plugin startup failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  if (!isRecord(hooks) || Object.keys(hooks).length === 0) {
    log("[oh-my-openagent] plugin startup returned no hooks")
    return
  }

  const stopEvents = await registerV1Hooks(ctx, hooks, state)
  const scratch: Record<string, unknown> = {}
  if (typeof hooks.config === "function") {
    try {
      await hooks.config(scratch)
    } catch (error) {
      log("[oh-my-openagent] config projection failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    await projectV1Surface({
      ctx,
      directory: v1Input.directory,
      config: scratch,
      tools: hooks.tool,
      defineTool: hooks["tool.definition"],
      commandBefore: typeof hooks["command.execute.before"] === "function"
        ? hooks["command.execute.before"] as (commandInput: { command: string; sessionID: string; arguments: string }, output: { parts: Array<{ type: string; text?: string }> }) => Promise<void>
        : undefined,
      ...(deps.agentDirectory ? { agentDirectory: deps.agentDirectory } : {}),
      recordTodos: { read: state.todos, write: state.recordTodos },
    })
  } catch (error) {
    log("[oh-my-openagent] domain projection failed", {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  let cachedOrigin: string | undefined
  const goalOrigin = async () => (cachedOrigin ??= await serveOrigin(process.argv, listenPortOf))
  const syncGoals = goalEnabled(v1Input.directory)
    ? createGoalSync({
      projectDir: v1Input.directory,
      session: {
        get: async ({ sessionID }) => {
          const origin = await goalOrigin()
          if (!origin) throw new Error("OpenCode server origin unknown")
          return getSessionRecord(origin, sessionID, fetch)
        },
        update: async ({ sessionID, metadata }) => {
          const origin = await goalOrigin()
          if (!origin) throw new Error("OpenCode server origin unknown")
          await patchSessionMetadata(origin, sessionID, jsonRecord(metadata), fetch)
        },
      },
    })
    : undefined
  const stopPublisher = startClientStatePublisher({
    stateDirectory: state.directory,
    owner: v1Input.directory,
    teamMode: teamModeConfig(v1Input.directory),
  })
  // Separate from the file publisher: it calls OpenCode, which can be slow or
  // not ready while this location boots, and must never hold the files back.
  const stopGoalSync = syncGoals ? startSerialLoop("goal sync", syncGoals, 2000, 10_000) : () => {}

  const dispose = hooks.dispose
  return async () => {
    stopEvents()
    stopPublisher()
    stopGoalSync()
    if (typeof dispose === "function") await dispose()
  }
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// Session metadata goes to OpenCode as JSON; anything else (undefined, functions) is dropped.
function jsonValue(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (Array.isArray(value)) return value.flatMap((item) => {
    const json = jsonValue(item)
    return json === undefined ? [] : [json]
  })
  return isRecord(value) ? jsonRecord(value) : undefined
}

function jsonRecord(value: Record<string, unknown>): { [key: string]: JsonValue } {
  const record: { [key: string]: JsonValue } = {}
  for (const [key, item] of Object.entries(value)) {
    const json = jsonValue(item)
    if (json !== undefined) record[key] = json
  }
  return record
}

function goalEnabled(directory: string): boolean {
  try {
    return validatePluginConfig(directory).config.goal?.enabled === true
  } catch {
    return false
  }
}

function teamModeConfig(directory: string): ReturnType<typeof validatePluginConfig>["config"]["team_mode"] {
  try {
    return validatePluginConfig(directory).config.team_mode
  } catch (error) {
    log("[oh-my-openagent] team mode config unavailable for client state", {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
