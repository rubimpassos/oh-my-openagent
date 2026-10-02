import type { PluginInput } from "@opencode-ai/plugin"
import { dispatchInternalPrompt, isInternalPromptDispatchAccepted } from "../shared/prompt-async-gate"
import { createGoalController, type GoalController } from "./controller"
import { hasActiveBackgroundTaskFor } from "../../features/background-agent/task-registry"
import { buildContinuationPrompt } from "./prompt"
import { goalUsageFromMessages } from "./usage"
import type { Goal } from "./types"

export type GoalHookOptions = {
  readonly projectDir: string
  readonly autoStart?: boolean
  readonly ultrawork?: boolean
  readonly getSessionExists?: (sessionID: string) => Promise<boolean>
  /** Continuations allowed before the goal stops as `blocked` (config `goal.default_max_iterations`). */
  readonly maxTurns?: number
  /** Whether a background task launched from the session still runs; its result wakes the session. */
  readonly hasActiveBackgroundTasks?: (sessionID: string) => boolean
  /** Delay before looking again when the prompt gate still held the session. */
  readonly retryDelayMs?: number
}

const DEFAULT_MAX_TURNS = 100

export type GoalHook = {
  readonly setGoal: (sessionID: string, objective: string) => Goal
  readonly getGoal: (sessionID: string) => Goal | null
  readonly pauseGoal: (sessionID: string) => Goal | null
  readonly resumeGoal: (sessionID: string) => Goal | null
  readonly clearGoal: (sessionID: string) => boolean
  readonly markComplete: (sessionID: string) => Goal | null
  readonly event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
}

const HOOK_NAME = "goal"

function getSessionIDFromEvent(properties: unknown): string | undefined {
  if (typeof properties === "object" && properties !== null) {
    const maybe = (properties as { sessionID?: string }).sessionID
    if (typeof maybe === "string") return maybe
    const maybeId = (properties as { id?: string }).id
    if (typeof maybeId === "string") return maybeId
  }
  return undefined
}

export function createGoalHook(ctx: PluginInput, options: GoalHookOptions): GoalHook {
  const controller: GoalController = createGoalController({ projectDir: options.projectDir })
  const inFlightContinuations = new Set<string>()

  const hasActiveBackgroundTasks = options.hasActiveBackgroundTasks ?? hasActiveBackgroundTaskFor
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS

  async function readMessages(sessionID: string): Promise<unknown[] | null> {
    try {
      const response: unknown = await ctx.client.session.messages({ path: { id: sessionID } })
      const data = typeof response === "object" && response !== null && "data" in response ? (response as { data: unknown }).data : response
      return Array.isArray(data) ? data : null
    } catch {
      return null
    }
  }

  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const retryDelayMs = options.retryDelayMs ?? 3_000
  function scheduleRetry(sessionID: string): void {
    if (retryTimers.has(sessionID)) return
    const timer = setTimeout(() => {
      retryTimers.delete(sessionID)
      void handleSessionIdle(sessionID)
    }, retryDelayMs)
    timer.unref?.()
    retryTimers.set(sessionID, timer)
  }

  async function handleSessionIdle(sessionID: string): Promise<void> {
    const initial = controller.getGoal(sessionID)
    if (initial === null || initial.status !== "active") {
      return
    }
    // Background work launched from this session reports back by waking it;
    // a continuation now would talk over that result.
    if (hasActiveBackgroundTasks(sessionID)) {
      return
    }
    if (inFlightContinuations.has(sessionID)) {
      return
    }
    inFlightContinuations.add(sessionID)
    try {
      const messages = await readMessages(sessionID)
      if (messages) controller.recordUsage(sessionID, goalUsageFromMessages(messages, initial.createdAt))
      const goal = controller.getGoal(sessionID)
      if (goal === null || goal.status !== "active") return
      if (goal.tokenBudget !== undefined && goal.tokensUsed >= goal.tokenBudget) {
        controller.settle(sessionID, "budgetLimited")
        return
      }
      if (goal.turnsUsed >= maxTurns) {
        controller.settle(sessionID, "blocked")
        return
      }
      const promptText = buildContinuationPrompt(goal)
      const promptResult = await dispatchInternalPrompt({
        mode: "async",
        client: ctx.client,
        sessionID,
        source: `${HOOK_NAME}:idle-continuation`,
        settleMs: 150,
        queueBehavior: "defer",
        // Every continuation reads alike, so the gate's semantic dedupe would
        // swallow the next one when a turn takes under its hold window. One
        // key per goal turn keeps duplicates of the same turn out and lets
        // the next turn through.
        dedupeKey: `goal:${goal.id}:${goal.turnsUsed}`,
        input: {
          path: { id: sessionID },
          body: {
            parts: [{ type: "text", text: promptText }],
          },
        },
      })
      if (promptResult.status === "dispatched" || (promptResult.status === "failed" && isInternalPromptDispatchAccepted(promptResult))) {
        controller.noteContinuation(sessionID)
      } else if (promptResult.status === "reserved") {
        // The gate still holds the previous dispatch (a short turn finished
        // inside its hold window). No idle will come again on its own, so look
        // once more shortly instead of leaving the goal stalled.
        scheduleRetry(sessionID)
      }
      if (promptResult.status === "failed" && !isInternalPromptDispatchAccepted(promptResult)) {
        // Log only; the dispatch may still have been accepted by another route.
        // eslint-disable-next-line no-console
        console.warn(`[${HOOK_NAME}] Idle continuation dispatch failed`, promptResult.error)
      }
    } finally {
      inFlightContinuations.delete(sessionID)
    }
  }

  async function handleSessionDeleted(sessionID: string): Promise<void> {
    controller.clearGoal(sessionID)
  }

  return {
    setGoal: controller.setGoal,
    getGoal: controller.getGoal,
    pauseGoal: controller.pauseGoal,
    resumeGoal: controller.resumeGoal,
    clearGoal: controller.clearGoal,
    markComplete: controller.markComplete,

    event: async (input) => {
      const { event } = input
      const sessionID = getSessionIDFromEvent(event.properties)
      if (sessionID === undefined) {
        return
      }
      switch (event.type) {
        case "session.idle":
          await handleSessionIdle(sessionID)
          break
        case "session.deleted":
          await handleSessionDeleted(sessionID)
          break
        default:
          break
      }
    },
  }
}
