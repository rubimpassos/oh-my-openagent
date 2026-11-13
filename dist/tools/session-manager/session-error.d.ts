export declare function describeSessionError(error: unknown): string;
export declare function toSessionError(error: unknown): Error;
export type SkippedSession = {
    readonly id: string;
    readonly reason: string;
};
export declare function formatSkippedSessions(skipped: readonly SkippedSession[]): string;
