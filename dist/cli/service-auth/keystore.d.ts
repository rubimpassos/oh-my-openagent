import type { z } from "zod";
import { type Credentials, SignInError } from "./protocol";
import type { HelperLease } from "./keychain-helper/client";
import { type KeychainHelperOptions } from "./keychain-helper/darwin-backend";
import { type WriteIntent } from "./keychain-helper/darwin-store";
import { type LockedStore } from "./keychain-helper/store-binding";
import { type SecretServiceLockProbe } from "./secret-service-lock";
type SecretKey = {
    readonly service: string;
    readonly name: string;
};
export type SecretApi = {
    readonly get: (key: SecretKey) => Promise<string | null>;
    readonly set: (key: SecretKey & {
        readonly value: string;
    }) => Promise<void>;
    readonly delete: (key: SecretKey) => Promise<boolean>;
};
export type { LockedStore };
export type SealedStore<T> = {
    readonly read: () => Promise<T | null>;
    /** A read started now that never joins a coalesced read begun earlier; credential transactions use it under the lock. */
    readonly readAuthoritative: () => Promise<T | null>;
    /**
     * `intent` matters only to the keychain helper: row 8b retires an unreadable item only on a fresh sign-in, and runs
     * `beforeRetire` first so the caller can report that discard.
     */
    readonly write: (value: T, intent?: WriteIntent, beforeRetire?: () => Promise<void>) => Promise<void>;
    readonly clear: () => Promise<void>;
    /** Before the session lock: settles any approval, so no access dialog is ever open while the lock is held. */
    readonly prepare?: () => Promise<void>;
    /** The helper's view for this locked section (recovered first), or null when this store has no helper. */
    readonly underLock?: (lease: HelperLease) => Promise<LockedStore<T> | null>;
    /** True while the last read came from an item the helper does not own yet: the token path then takes the lock once. */
    readonly migrationPending?: () => Promise<boolean>;
};
export type CredentialStore = SealedStore<Credentials>;
export declare class CredentialStoreError extends SignInError {
}
export declare class KeychainLockedError extends CredentialStoreError {
}
export declare class SecretServiceUnavailableError extends CredentialStoreError {
}
export declare class InvalidCredentialState extends SignInError {
}
/** The stored credential is no longer the identity and generation a caller captured. */
export declare class CredentialIdentityChanged extends Error {
    constructor();
}
/** The OS store has not answered a read in time: it is waiting on a person (a keychain approval dialog, #11262). */
export declare class KeychainApprovalPendingError extends CredentialStoreError {
}
/**
 * How long a read waits for an OS store that has not answered. An unanswered approval dialog blocks the native read
 * with no end, so a session path (memory sync, the memory tool, a host's token) gives up at a deadline and an
 * interactive command keeps waiting but says why.
 */
export type CredentialReadWait = {
    readonly kind: "bounded";
    readonly deadlineMs: number;
} | {
    readonly kind: "interactive";
    readonly noticeAfterMs: number;
    readonly notice: (message: string) => void;
};
export declare const SESSION_READ_WAIT: CredentialReadWait;
export declare const INTERACTIVE_READ_WAIT: CredentialReadWait;
export declare const quietNotice: (_message: string) => void;
export declare function credentialId(api: string): string;
export declare function createCredentialStore(api: string, options?: {
    readonly secrets?: SecretApi | null;
    readonly platform?: NodeJS.Platform;
    readonly lockProbe?: SecretServiceLockProbe;
    readonly notice?: (message: string) => void;
    readonly wait?: CredentialReadWait;
    readonly home?: string;
    readonly keychainHelper?: KeychainHelperOptions;
}): CredentialStore;
export declare function createSealedStore<T>(api: string, namespace: "omo-cli" | "omo-cli-v2" | "omo-cli-revocations-v2", schema: z.ZodType<T>, secrets?: SecretApi | null, platform?: NodeJS.Platform, lockProbe?: SecretServiceLockProbe, notice?: (message: string) => void, wait?: CredentialReadWait, amendWrite?: (previous: T | null, next: T) => T, keychainHelper?: KeychainHelperOptions): SealedStore<T>;
