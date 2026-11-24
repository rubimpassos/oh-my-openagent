import type { Plugin } from "@opencode/plugin"
import { reconcileNativeModelPrompts } from "../agents/native-model-prompt"
import { hookMessagesToV1, writeHookMessagesBack } from "./message-shape"
import { safeCall, type V1Handler } from "./hook-invocation"

export type ClientPresentation = {
  readonly surface: () => "terminal" | "chat"
}

export async function registerContextHook(ctx: Plugin.Context, input: {
  readonly systemTransform?: V1Handler
  readonly messagesTransform?: V1Handler
  readonly chatParams?: V1Handler
  readonly presentation?: ClientPresentation
}): Promise<void> {
  await ctx.session.hook("context", (event) => safeCall("context", async () => {
    if (input.systemTransform) {
      const output = { system: event.system.map((part) => part.text) }
      await input.systemTransform({
        sessionID: event.sessionID,
        model: { id: event.model.id, providerID: event.model.providerID },
      }, output)
      const model = event.model.id.startsWith(`${event.model.providerID}/`)
        ? event.model.id
        : `${event.model.providerID}/${event.model.id}`
      reconcileNativeModelPrompts(
        output.system, model, undefined, undefined, undefined,
        input.presentation?.surface() ?? "terminal",
      )
      event.system.splice(0, event.system.length, ...output.system.map((text) => ({ type: "text" as const, text })))
    }
    if (input.messagesTransform) {
      const output = { messages: hookMessagesToV1(event.messages, event.sessionID) }
      await input.messagesTransform({}, output)
      const next = writeHookMessagesBack(event.messages, output.messages)
      event.messages.splice(0, event.messages.length, ...next)
    }
    if (input.chatParams) {
      const output: {
        temperature?: number
        topP?: number
        topK?: number
        maxOutputTokens?: number
        options: Record<string, unknown>
      } = { options: {} }
      await input.chatParams({
        sessionID: event.sessionID,
        agent: { name: String(event.agent) },
        model: { providerID: event.model.providerID, modelID: event.model.id },
        provider: { id: event.model.providerID },
        message: { variant: event.model.variant },
      }, output)
      if (output.temperature !== undefined) event.options.temperature = output.temperature
      if (output.topP !== undefined) event.options.topP = output.topP
      if (output.topK !== undefined) event.options.topK = output.topK
      if (output.maxOutputTokens !== undefined) event.options.maxTokens = output.maxOutputTokens
      Object.assign(event.options, output.options)
    }
  }))
}
