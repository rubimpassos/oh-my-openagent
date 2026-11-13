import { type LockLease } from "@oh-my-opencode/team-core/team-state-store/locks";
import { accountHome } from "./account-home";
export { accountHome };
/**
 * The one per-origin lock and desktop generation record (account-transport-api v7 section 4.1). The CLI, desktop main
 * and the engine pin boundary all derive these paths here or with the same inputs; never pass a path around instead.
 */
export declare function credentialLockPaths(api: string, home?: string): {
    readonly directory: string;
    readonly lock: string;
    readonly desktopRecord: string;
};
/** The lease of the origin lock this async context already holds, or undefined outside that lock. */
export declare function heldCredentialLease(api: string, home?: string): LockLease | undefined;
/**
 * Writers and effect boundaries share one origin lock; nested session writes retain ownership and see the outer lease,
 * which the keychain helper needs to take the lock over for a mutation (#11262 design 3.6).
 */
export declare function withCredentialLock<T>(api: string, action: (lease: LockLease) => Promise<T>, home?: string, ownerTag?: string): Promise<T>;
