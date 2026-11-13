export type CompactionInFlight = {
    gen: number;
    startedAt: number;
    messageID?: string;
    endedAt?: number;
};
export declare function recordCompactionStart(sessionID: string, messageID?: string): void;
export declare function recordCompactionEnd(sessionID: string, expectedGeneration?: number, expectedMessageID?: string): void;
export declare function clearAllCompactions(): void;
export declare function getCompaction(sessionID: string): CompactionInFlight | undefined;
export declare function isCompactionInFlight(sessionID: string): boolean;
export declare function observeCompactionEvent(event: {
    type: string;
    properties?: unknown;
}): void;
