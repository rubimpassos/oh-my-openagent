import type { PluginInput } from "@opencode-ai/plugin";
import type { SessionMessage, SessionMetadata, TodoItem } from "./types";
type ExperimentalSessionList = (input: {
    roots?: boolean;
    cursor?: number;
    limit: number;
}) => Promise<unknown>;
export type GlobalSessionClient = {
    experimental: {
        session: {
            list: ExperimentalSessionList;
        };
    };
};
export declare function getSdkMainSessions(client: PluginInput["client"], directory?: string, globalClient?: GlobalSessionClient, limit?: number): Promise<SessionMetadata[]>;
export declare function getSdkAllSessions(client: PluginInput["client"], globalClient?: GlobalSessionClient, limit?: number): Promise<string[]>;
export declare function sdkSessionExists(client: PluginInput["client"], sessionID: string): Promise<boolean>;
export declare function getSdkSessionMessages(client: PluginInput["client"], sessionID: string, signal?: AbortSignal): Promise<SessionMessage[]>;
export declare const SDK_MESSAGE_PAGE_SIZE = 100;
export type SessionMessagePage = {
    messages: SessionMessage[];
    nextCursor?: string;
    cursorReadable: boolean;
};
export declare function getSdkSessionMessagePage(client: PluginInput["client"], sessionID: string, page: {
    limit: number;
    before?: string;
}, signal?: AbortSignal): Promise<SessionMessagePage>;
export declare function forEachSdkSessionMessagePage(client: PluginInput["client"], sessionID: string, visit: (messages: SessionMessage[]) => boolean | void, options?: {
    pageSize?: number;
    signal?: AbortSignal;
}): Promise<void>;
export declare function getSdkSessionMessageWindow(client: PluginInput["client"], sessionID: string, window: {
    limit: number;
    fromEnd: boolean;
}, signal?: AbortSignal): Promise<SessionMessage[]>;
export declare function getSdkSessionTodos(client: PluginInput["client"], sessionID: string): Promise<TodoItem[]>;
export declare function shouldFallbackFromSdkError(error: unknown): boolean;
export {};
