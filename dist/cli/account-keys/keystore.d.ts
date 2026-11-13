export type KeyStore = {
    readonly read: () => Promise<string | null>;
    readonly write: (value: string) => Promise<void>;
};
export type SecretCommandResult = {
    code: number;
    stdout: string;
    stderr: string;
};
/**
 * Runs a secret-handling CLI. Secret material is passed only on the child's
 * stdin (`input`), never on argv. `argv` must never carry secret bytes; the
 * keystore implementations below place every secret on stdin exclusively.
 * Pass `undefined` as the fourth `createOsKeyStore` argument to auto-select
 * `Bun.secrets`, or supply `run`/`null` to force the CLI backend.
 */
export type RunSecretCommand = (argv: readonly string[], input?: string) => Promise<SecretCommandResult>;
export type SecretApi = {
    readonly get: (key: {
        service: string;
        name: string;
    }) => Promise<string | null>;
    readonly set: (key: {
        service: string;
        name: string;
        value: string;
    }) => Promise<void>;
};
/**
 * The OS keystore backends the CLI device keyring accepts. Anything that can
 * only persist in plaintext (a dotfile, an unencrypted sqlite row, a world-
 * readable registry value) is never a fallback: callers refuse instead.
 */
export declare function createOsKeyStore(name: string, platform?: NodeJS.Platform, run?: RunSecretCommand, secrets?: SecretApi | null): KeyStore;
