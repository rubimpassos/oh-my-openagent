import type { PluginInput } from "@opencode-ai/plugin";
import { type GlobalSessionClient } from "./sdk-storage";
import type { SessionInfo, SessionMessage, SessionMetadata, TodoItem } from "./types";
export interface GetMainSessionsOptions {
    directory?: string;
    limit?: number;
}
export declare function setStorageClient(client: PluginInput["client"], globalClient?: GlobalSessionClient): void;
export declare function resetStorageClient(): void;
export declare function getMainSessions(options: GetMainSessionsOptions): Promise<SessionMetadata[]>;
export declare function getAllSessions(limit?: number): Promise<string[]>;
export { getMessageDir } from "../../shared/opencode-message-dir";
export declare function sessionExists(sessionID: string): Promise<boolean>;
export type ReadSessionMessagesOptions = {
    limit?: number;
    fromEnd?: boolean;
    signal?: AbortSignal;
};
export declare function readSessionMessages(sessionID: string, options?: ReadSessionMessagesOptions): Promise<SessionMessage[]>;
export declare function forEachSessionMessagePage(sessionID: string, visit: (messages: SessionMessage[]) => boolean | void, signal?: AbortSignal): Promise<void>;
export declare function readSessionTodos(sessionID: string): Promise<TodoItem[]>;
export declare function readSessionTranscript(sessionID: string): Promise<number>;
export declare function getSessionInfo(sessionID: string, signal?: AbortSignal): Promise<SessionInfo | null>;
