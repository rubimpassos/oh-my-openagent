import { configureSharedSubunitLogger } from "@oh-my-opencode/utils"
import {
  dispatchInternalPrompt as dispatchSharedInternalPrompt,
  type InternalPromptDispatchArgs,
  type InternalPromptDispatchResult,
} from "@oh-my-opencode/utils/prompt-async-gate"
import { isGoalPaused } from "../hooks/goal/continuation-policy"
import { syncGoalFromClient } from "../hooks/goal/sync-bridge"
import { isRecord } from "./record-type-guard"
import {
  LIVE_ROUTE_DISPATCH_LOG,
  LIVE_ROUTE_UNAVAILABLE_LOG,
  configurePromptDispatchRouteResolver,
} from "@oh-my-opencode/utils/prompt-async-gate/route-resolver"

import {
  isPreSendConnectionFailure,
  markLiveRouteUnavailable,
  resolveDispatchClient,
  tryResolveDispatchClientSync,
} from "./live-server-route"
import { log } from "./logger"

configureSharedSubunitLogger(log)
configurePromptDispatchRouteResolver({
  tryResolveDispatchClientSync,
  resolveDispatchClient,
  isPreSendConnectionFailure,
  markLiveRouteUnavailable,
})

export {
  LIVE_ROUTE_DISPATCH_LOG,
  LIVE_ROUTE_UNAVAILABLE_LOG,
}
export * from "@oh-my-opencode/utils/prompt-async-gate"

const GOAL_CONTINUATION_SOURCES = new Set(["todo-continuation-enforcer", "atlas", "goal:idle-continuation"])

export function dispatchInternalPrompt<TInput>(args: InternalPromptDispatchArgs<TInput>): Promise<InternalPromptDispatchResult> {
  const input: unknown = args.input
  const directory = isRecord(input) && isRecord(input.query) && typeof input.query.directory === "string"
    ? input.query.directory
    : undefined
  if (!directory || !GOAL_CONTINUATION_SOURCES.has(args.source)) return dispatchSharedInternalPrompt(args)

  return dispatchSharedInternalPrompt({
    ...args,
    shouldDispatch: async () => {
      if (args.shouldDispatch && !(await args.shouldDispatch())) return false
      await syncGoalFromClient(directory, args.sessionID)
      return !isGoalPaused(directory, args.sessionID)
    },
  })
}
