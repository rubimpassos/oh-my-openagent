type SessionMessage = {
    info?: {
        role?: string;
        error?: unknown;
    };
};
export declare const MIN_ERRORED_IDLE_POLLS = 10;
export declare function getStoppedSessionError(messages: readonly SessionMessage[]): string | undefined;
export {};
