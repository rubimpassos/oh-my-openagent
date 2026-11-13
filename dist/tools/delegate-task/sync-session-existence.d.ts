import type { OpencodeClient } from "./types";
export declare function isDefiniteSessionNotFound(error: unknown): boolean;
export declare function isSyncSessionDeleted(client: OpencodeClient, sessionID: string): Promise<boolean>;
export declare function formatDeletedSyncSessionError(sessionID: string): string;
