import type { RpcHandlers, RpcRegistration } from "@opencode/plugin/promise/rpc"
import type { TeamModeConfig } from "@oh-my-opencode/team-core/config"
import { getBackgroundTaskControl, listRegisteredBackgroundTasks } from "../features/background-agent/task-registry"
import { registerGoalSync } from "../hooks/goal/sync-bridge"
import { createClientAttachment, type ClientCallbackRpc } from "./client-attachment"
import { clientRpc, type ClientApiState } from "./client-api-contract"
import { providerHealth, runClientRequest } from "./client-control"
import { createClientGoalControl, type ClientSessionReader } from "./client-goal-control"
import { backgroundTasksByParent, goalsBySession, plansBySession, teamRunsByLead } from "./client-state"

type ClientRpc = ClientCallbackRpc & {
  readonly register: (
    definition: typeof clientRpc,
    handlers: RpcHandlers<typeof clientRpc>,
  ) => Promise<RpcRegistration<typeof clientRpc>>
}

export type ClientApiOptions = {
  readonly ctx: { readonly rpc: ClientRpc; readonly session: ClientSessionReader }
  readonly owner: string
  readonly goalEnabled: boolean
  readonly teamMode?: TeamModeConfig
  readonly categories?: Record<string, string[]>
}

export type ClientApi = {
  readonly dispose: () => Promise<void>
  readonly surface: () => "terminal" | "chat"
  readonly invalidate: () => Promise<void>
}

export async function startClientApi(input: ClientApiOptions): Promise<ClientApi> {
  const attachment = createClientAttachment(input.ctx.rpc)
  const controlGoal = createClientGoalControl({ owner: input.owner, goalEnabled: input.goalEnabled, session: input.ctx.session })
  let revision = 0
  let disposed = false
  let registration: RpcRegistration<typeof clientRpc> | undefined
  const invalidate = async (): Promise<void> => {
    if (disposed) return
    revision += 1
    await registration?.events.emit("stateChanged", { instanceID: attachment.instanceID, revision })
  }
  registration = await input.ctx.rpc.register(clientRpc, {
    describe: async () => ({
      version: 1, instanceID: attachment.instanceID, directory: input.owner,
      capabilities: { goals: input.goalEnabled, tasks: getBackgroundTaskControl(input.owner) !== undefined, presentation: true },
      client: attachment.describe(),
    }),
    getState: async ({ sessionID }): Promise<ClientApiState> => {
      const teams = input.teamMode?.enabled ? await teamRunsByLead(input.teamMode) : {}
      const tasks = listRegisteredBackgroundTasks(input.owner)
      const select = <T>(entries: Record<string, T>): Record<string, T> => Object.fromEntries(
        Object.entries(entries).filter(([id]) => sessionID === undefined || id === sessionID),
      )
      return {
        instanceID: attachment.instanceID, revision, directory: input.owner,
        tasks: select(backgroundTasksByParent(tasks)), goals: select(goalsBySession(input.owner)),
        plans: select(plansBySession(input.owner)), teams: select(teams),
        health: { categories: input.categories ?? {}, providers: providerHealth(tasks, Date.now()) },
      }
    },
    controlGoal: async (request) => {
      const current = attachment.guard(request.attachment)
      if (!current()) return { ok: false, error: { code: "stale_attachment", message: "Client attachment changed." } }
      const result = await controlGoal(request, current)
      if (result.ok) await invalidate()
      return result
    },
    controlTask: async (request) => {
      const current = attachment.guard(request.attachment)
      if (!current()) return { ok: false, error: { code: "stale_attachment", message: "Client attachment changed." } }
      const control = getBackgroundTaskControl(input.owner)
      if (!control) return { ok: false, error: { code: "unsupported", message: "No task manager is running." } }
      const owned = () => listRegisteredBackgroundTasks(input.owner).some((task) => task.id === request.taskId)
      if (!owned()) return { ok: false, error: { code: "not_found", message: "Task is not owned by this instance." } }
      const task = control.getTask(request.taskId)
      if (!task) return { ok: false, error: { code: "not_found", message: "Task is not owned by this instance." } }
      const session = await input.ctx.session.get({ sessionID: task.parentSessionId })
      if (!owned() || session.location.directory !== input.owner || control.getTask(request.taskId)?.parentSessionId !== task.parentSessionId) {
        return { ok: false, error: { code: "wrong_location", message: "Task session belongs to another location." } }
      }
      const result = await runClientRequest(request, control, current)
      switch (result.ok) {
        case true:
          await invalidate()
          return result
        case false:
          return { ok: false, error: result.error }
        default:
          result satisfies never
          throw new TypeError("Unknown client task result")
      }
    },
    attach: async (request) => {
      const result = attachment.attach(request)
      if (result.ok) await invalidate()
      return result
    },
    detach: async (request) => {
      const detached = attachment.detach(request)
      if (detached) await invalidate()
      return { detached }
    },
  })
  const unregister = registerGoalSync(input.owner, attachment.sync)
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    attachment.dispose()
    unregister()
    await registration?.dispose()
  }
  try {
    await registration.events.emit("ready", { instanceID: attachment.instanceID, revision })
  } catch (error) {
    await dispose()
    throw error
  }
  return { dispose, surface: attachment.surface, invalidate }
}
