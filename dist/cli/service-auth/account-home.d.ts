/** What the OS says about the user running this process; tests pass their own (#12978). */
export interface PlatformFacts {
    readonly platform: NodeJS.Platform;
    readonly uid: number | undefined;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly readFile: (path: string) => string;
    readonly isFile: (path: string) => boolean;
    /** Always called with an absolute executable path, never a bare name a search could resolve. */
    readonly run: (command: string, args: readonly string[]) => string;
}
/** What the default lock home is chosen from. Tests and fixtures pass their own; there is no environment override (#12978). */
export interface AccountFacts {
    /** The home the OS user record names, independent of $HOME and %USERPROFILE%; undefined when the OS cannot say. */
    readonly recordHome: () => string | undefined;
    /** $HOME or %USERPROFILE%: the lock home before #12978, and the fallback when the record's home cannot hold the lock. */
    readonly homedir: () => string;
    /** Creates the lock directory and proves it writable, or throws. */
    readonly prepareLockDirectory: (directory: string) => void;
    readonly warn: (message: string) => void;
}
export declare const lockDirectoryIn: (home: string) => string;
/**
 * The OS user record's home. The credential item belongs to the OS user (the Secret Service on the session bus, the
 * login Keychain, Credential Manager), not to $HOME, and Bun's homedir() and userInfo() both answer $HOME/%USERPROFILE%.
 */
export declare function userRecordHome(facts: PlatformFacts): string | undefined;
/**
 * The record's home when it can hold the lock; otherwise today's homedir() with one warning, so a read-only or missing
 * account home never fails a sign-in because of where the lock lives.
 */
export declare function chooseLockHome(facts: AccountFacts): string;
export declare const systemPlatformFacts: PlatformFacts;
export declare const systemAccountFacts: AccountFacts;
/** Names the lock home of a CLI child a test starts; read only in a process whose credential store is a test stand-in. */
export declare const TEST_LOCK_HOME_ENV = "OMO_TEST_CREDENTIAL_LOCK_HOME";
/**
 * The lock home a test hands to the real CLI it starts as a child, whose in-process facts the test cannot replace.
 * Honored only when the process's Bun.secrets carries the stand-in marker that the test preload (test-hermetic-home.ts)
 * and the launcher-child fixtures set: such a process holds no real credential, so moving its lock cannot split one.
 * A production process never has the marker and ignores the variable. An override it honored would put two processes of
 * one OS user on different locks for the same sign-in again, which is #12978 itself.
 */
export declare function testLockHome(env: Readonly<Record<string, string | undefined>>, secrets: unknown): string | undefined;
/** Where every process of this OS user meets on one credential lock, chosen once per process (#12978). */
export declare function accountHome(): string;
/** Test preloads and fixtures only; returns the facts it replaced. */
export declare function useAccountFacts(next: AccountFacts): AccountFacts;
