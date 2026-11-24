import { randomUUID } from "node:crypto"
import type { z } from "zod"
import { clientRpc, continuationRpc, type ClientAttachment } from "./client-api-contract"

type Callback = ReturnType<typeof continuationRpc>["methods"]["beforeGoalContinuation"]
export type ClientCallbackRpc = (definition: ReturnType<typeof continuationRpc>) => {
  readonly beforeGoalContinuation: (
    input: z.input<Callback["input"]>,
    options: { readonly signal: AbortSignal },
  ) => Promise<z.output<Callback["output"]>>
}

type AttachedClient = z.infer<typeof clientRpc.methods.describe.output>["client"]
type AttachmentRequest = z.infer<typeof clientRpc.methods.attach.input>
type AttachmentResult = z.infer<typeof clientRpc.methods.attach.output>

export function createClientAttachment(rpc: ClientCallbackRpc) {
  const instanceID = randomUUID()
  let client: (NonNullable<AttachedClient> & { readonly callbackRPCID: string }) | null = null
  let disposed = false
  const matches = (attachment: ClientAttachment): boolean => (
    !disposed && client !== null &&
    attachment.instanceID === instanceID && attachment.generation === client.attachment.generation
  )
  return {
    instanceID,
    describe(): AttachedClient {
      return client ? { clientID: client.clientID, attachment: { ...client.attachment }, presentation: { ...client.presentation } } : null
    },
    surface(): "terminal" | "chat" {
      return client?.presentation.surface ?? "terminal"
    },
    guard(attachment?: ClientAttachment): () => boolean {
      return () => !disposed && (attachment === undefined || matches(attachment))
    },
    attach(request: AttachmentRequest): AttachmentResult {
      if (disposed || request.instanceID !== instanceID) {
        return { ok: false, error: { code: "stale_attachment", message: "Client instance changed." } }
      }
      if (client && client.clientID !== request.clientID) {
        return { ok: false, error: { code: "client_conflict", message: "Another client owns this location." } }
      }
      const attachment = { instanceID, generation: randomUUID() }
      client = { clientID: request.clientID, callbackRPCID: request.callbackRPCID, presentation: { ...request.presentation }, attachment }
      return { ok: true, attachment: { ...attachment } }
    },
    detach(attachment: ClientAttachment): boolean {
      if (!matches(attachment)) return false
      client = null
      return true
    },
    async sync(sessionID: string, expectedGoalID: string): Promise<() => boolean> {
      const captured = client
      if (captured) {
        await rpc(continuationRpc(captured.callbackRPCID)).beforeGoalContinuation({
          attachment: { ...captured.attachment }, sessionID, expectedGoalID,
        }, { signal: AbortSignal.timeout(5000) })
      }
      return () => !disposed && client === captured
    },
    dispose(): void {
      disposed = true
      client = null
    },
  }
}
