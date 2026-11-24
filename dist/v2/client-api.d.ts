import type { RpcHandlers, RpcRegistration } from "@opencode/plugin/promise/rpc";
import type { TeamModeConfig } from "@oh-my-opencode/team-core/config";
import { type ClientCallbackRpc } from "./client-attachment";
import { clientRpc } from "./client-api-contract";
import { type ClientSessionReader } from "./client-goal-control";
type ClientRpc = ClientCallbackRpc & {
    readonly register: (definition: typeof clientRpc, handlers: RpcHandlers<typeof clientRpc>) => Promise<RpcRegistration<typeof clientRpc>>;
};
export type ClientApiOptions = {
    readonly ctx: {
        readonly rpc: ClientRpc;
        readonly session: ClientSessionReader;
    };
    readonly owner: string;
    readonly goalEnabled: boolean;
    readonly teamMode?: TeamModeConfig;
    readonly categories?: Record<string, string[]>;
};
export type ClientApi = {
    readonly dispose: () => Promise<void>;
    readonly surface: () => "terminal" | "chat";
    readonly invalidate: () => Promise<void>;
};
export declare function startClientApi(input: ClientApiOptions): Promise<ClientApi>;
export {};
