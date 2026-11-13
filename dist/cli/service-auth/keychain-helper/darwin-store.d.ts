import type { HelperLease } from "./client";
import { type DarwinReadDeps } from "./darwin-read";
export type WriteIntent = "fresh-sign-in" | "update";
export type DarwinStoreDeps = DarwinReadDeps & {
    /** Today's overwrite of an item another identity owns (silent, m5): keeps that item's access list. */
    readonly ownOverwrite: (value: string) => Promise<void>;
    /** Today's delete of `<A>` by this process's identity (may prompt, v9 3.1); `<A>.old` silently. */
    readonly ownDelete: (name: string) => Promise<boolean>;
    /** One notice per process for a failed migration (v9 3.3: it never fails the section). */
    readonly notice: (message: string) => void;
};
export type LockedDarwinStore = {
    readonly recover: () => Promise<void>;
    readonly read: () => Promise<string | null>;
    readonly settle: () => Promise<void>;
    /** `beforeRetire` runs once, just before row 8b moves an unreadable item aside (the session reports that discard). */
    readonly write: (value: string, intent: WriteIntent, beforeRetire?: () => Promise<void>) => Promise<void>;
    readonly clear: () => Promise<void>;
};
/** RULING-73: every retired slot holds a copy nothing here can remove; the user must delete them once. */
export declare class HelperOldSlotsFull extends Error {
}
/**
 * The session-lock view (design 3.3, 3.4, 3.6): every helper mutation is handed the lease; reads never prompt (an
 * approval comes from `prepare()` before the lock); recovery runs at the start of every section, migration only from
 * `accessToken()`'s section via `settle()`.
 */
export declare function lockedDarwinStore(deps: DarwinStoreDeps, lease: HelperLease): LockedDarwinStore;
