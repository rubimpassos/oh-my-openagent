import type { HelperAccess } from "./access";
import type { ApprovalCache } from "./approval-cache";
import type { HelperReply } from "./client";
export type ReadSource = "owned" | "owned-unmarked" | "own-identity" | "approved";
export type ReadResult = {
    readonly kind: "value";
    readonly value: string;
    readonly source: ReadSource;
    readonly reply: HelperReply;
} | {
    readonly kind: "missing";
    readonly reply: HelperReply;
};
/**
 * Row 8b (addendum, PRODUCT CALL, recommended default): the item's creator is gone and the only dialog left would be
 * the login-password kind. "re-login" reads as signed out so the user signs in again (save then retires the old item);
 * "password-dialog" asks anyway. Only the default may ship until the owner decides.
 */
export type Row8bChoice = "re-login" | "password-dialog";
export type ReadFailure = "locked" | "store" | "pending" | "denied";
export declare class HelperReadError extends Error {
    readonly failure: ReadFailure;
    constructor(failure: ReadFailure, message: string);
}
export type DarwinReadDeps = {
    readonly account: string;
    readonly access: Extract<HelperAccess, {
        kind: "ready";
    }>;
    /** This process's own identity, interaction off: the value, null when missing, or throws when refused. */
    readonly ownSilentGet: () => Promise<string | null>;
    readonly cache: ApprovalCache;
    /** R4: the machine-wide prompt lock, taken with zero wait; null when another process holds it. */
    readonly takePromptLock: () => Promise<(() => Promise<void>) | null>;
    /** Asks the side that created the item to migrate it before any prompt; true when that ran. */
    readonly handOff?: () => Promise<boolean>;
    readonly noDialog?: boolean;
    readonly background: boolean;
    readonly row8b?: Row8bChoice;
};
/**
 * Design 3.2 for one read: the helper's read; for an item another identity owns, this process's own silent read, then
 * the process's validated approval, then (outside the session lock only) the creator hand-off and at most one plain
 * `approve` dialog. A login-password dialog is never shown (addendum Q2): such an item reads per row 8b.
 */
export declare function readThroughHelper(deps: DarwinReadDeps, allowPrompt: boolean): Promise<ReadResult>;
