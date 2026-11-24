import type { z } from "zod";
import { clientRpc, continuationRpc, type ClientAttachment } from "./client-api-contract";
type Callback = ReturnType<typeof continuationRpc>["methods"]["beforeGoalContinuation"];
export type ClientCallbackRpc = (definition: ReturnType<typeof continuationRpc>) => {
    readonly beforeGoalContinuation: (input: z.input<Callback["input"]>, options: {
        readonly signal: AbortSignal;
    }) => Promise<z.output<Callback["output"]>>;
};
type AttachedClient = z.infer<typeof clientRpc.methods.describe.output>["client"];
type AttachmentRequest = z.infer<typeof clientRpc.methods.attach.input>;
type AttachmentResult = z.infer<typeof clientRpc.methods.attach.output>;
export declare function createClientAttachment(rpc: ClientCallbackRpc): {
    instanceID: `${string}-${string}-${string}-${string}-${string}`;
    describe(): AttachedClient;
    surface(): "terminal" | "chat";
    guard(attachment?: ClientAttachment): () => boolean;
    attach(request: AttachmentRequest): AttachmentResult;
    detach(attachment: ClientAttachment): boolean;
    sync(sessionID: string, expectedGoalID: string): Promise<() => boolean>;
    dispose(): void;
};
export {};
