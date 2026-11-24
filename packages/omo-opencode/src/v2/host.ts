import type { Plugin } from "@opencode/plugin"

import { log } from "../shared/logger"
import { setVersionCache } from "../shared/opencode-version"
import { validatePluginConfig } from "../config/validate"
import { createAdapterState } from "./adapter-state"
import { startClientStatePublisher } from "./client-state"
import { createV1PluginInput } from "./context-facade"
import { registerV1Hooks, type V1HookMap } from "./hook-bridge"
import { startClientApi } from "./client-api"
import { categoryModels } from "./client-control"
import { getBackgroundTaskControl } from "../features/background-agent/task-registry"
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

  let api: Awaited<ReturnType<typeof startClientApi>> | undefined
  const stopEvents = await registerV1Hooks(ctx, hooks, state, {
    surface: () => api?.surface() ?? "terminal",
  })
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

  const teamMode = teamModeConfig(v1Input.directory)
  const categories = categoryChains(v1Input.directory)
  try {
    api = await startClientApi({
      ctx,
      owner: v1Input.directory,
      goalEnabled: goalEnabled(v1Input.directory),
      teamMode,
      categories,
    })
  } catch (error) {
    stopEvents()
    throw error
  }
  const stopPublisher = startClientStatePublisher({
    stateDirectory: state.directory,
    owner: v1Input.directory,
    teamMode,
    categories,
    control: () => getBackgroundTaskControl(v1Input.directory),
    onStateChanged: api.invalidate,
  })

  const dispose = hooks.dispose
  return async () => {
    stopEvents()
    stopPublisher()
    await api?.dispose()
    if (typeof dispose === "function") await dispose()
  }
}

function categoryChains(directory: string): Record<string, string[]> {
  try {
    return categoryModels(validatePluginConfig(directory).config.categories)
  } catch {
    return {}
  }
}

function goalEnabled(directory: string): boolean {
  try {
    const config = validatePluginConfig(directory).config
    return config.goal?.enabled === true && !config.disabled_hooks?.includes("goal")
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
