import { type HelperAccess } from "./access";
import { type ApprovalCache } from "./approval-cache";
import { type Row8bChoice } from "./darwin-read";
import { type LockedDarwinStore } from "./darwin-store";
import type { HelperLease } from "./client";
import { type MarkerProbe } from "./owner-marker";
type SecretKey = {
    readonly service: string;
    readonly name: string;
};
type Secrets = {
    readonly get: (key: SecretKey) => Promise<string | null>;
    readonly set: (key: SecretKey & {
        readonly value: string;
    }) => Promise<void>;
    readonly delete: (key: SecretKey) => Promise<boolean>;
};
/**
 * Row 9b (addendum, ruled 2026-10-28): the item is helper-owned but no verified helper exists on this machine.
 * "reinstall-notice" (default) fails with a one-line notice and no dialog; "dialog" takes today's read, which prompts.
 */
export type Row9bChoice = "reinstall-notice" | "dialog";
/** Entry points with their own layout (the compiled binary's `execDir`, the desktop runtime) register their copy first. */
export declare function registerHelperCandidates(paths: readonly string[]): void;
/**
 * One resolution per process, shared by every bundled copy. An `unavailable` result (a transient pin or copy failure)
 * is not kept: the next resolve tries again, so a long-lived process does not stay on the helper-less path.
 */
export declare const helperAccess: () => Promise<HelperAccess>;
export declare function sharedHelperAccess(resolve: () => Promise<HelperAccess>): Promise<HelperAccess>;
export declare class HelperMissingForOwnedItem extends Error {
}
/** The error shapes keystore.ts already maps: a locked keychain carries -25308; a pending approval is its own kind. */
export declare function asKeystoreError(error: unknown, pending: (message: string) => Error): unknown;
/** What a test (or an entry point) may substitute; production uses the defaults. */
export type KeychainHelperOptions = {
    readonly access?: () => Promise<HelperAccess>;
    readonly ownerMarker?: MarkerProbe;
    readonly silently?: <T>(run: () => Promise<T>) => Promise<T>;
    readonly home?: string;
    readonly row8b?: Row8bChoice;
    readonly row9b?: Row9bChoice;
    readonly cache?: ApprovalCache;
    readonly handOff?: () => Promise<boolean>;
    readonly noDialog?: boolean;
};
export type DarwinBackend = {
    /** The read every caller outside the session lock shares (it may show the one plain approval dialog). */
    readonly read: () => Promise<string | null>;
    readonly underLock: (lease: HelperLease) => LockedDarwinStore;
    /** The last read outside the lock found a value the helper does not own yet; only a locked section migrates it. */
    readonly migrationPending: () => boolean;
};
export declare function createDarwinBackend(options: {
    readonly access: Extract<HelperAccess, {
        kind: "ready";
    }>;
    readonly secrets: Secrets;
    readonly service: string;
    readonly account: string;
    readonly background: boolean;
    readonly notice: (message: string) => void;
    readonly home?: string;
    readonly row8b?: Row8bChoice;
    readonly silently?: <T>(run: () => Promise<T>) => Promise<T>;
    readonly cache?: ApprovalCache;
    readonly handOff?: () => Promise<boolean>;
    readonly noDialog?: boolean;
}): DarwinBackend;
/**
 * Without a verified helper, the read is today's, except for an item the helper owns (row 9b): today's read could
 * only reach it through a dialog, so by default this answers with the reinstall notice instead.
 */
export declare function guardHelperlessRead(service: string, account: string, choice?: Row9bChoice, probe?: MarkerProbe): Promise<void>;
export {};
