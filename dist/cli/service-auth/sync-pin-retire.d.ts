import type { BeforeKeysDiscarded } from "./session";
export declare function retireSyncPinOnDiscard(options: {
    /** The trust-pin directory of the memory root the caller already resolves. */
    readonly pinDir: () => string;
    /** The caller's own logger; one line per pin it could not retire. */
    readonly log: (line: string) => void;
}): BeforeKeysDiscarded;
