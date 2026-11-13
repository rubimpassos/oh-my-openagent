/**
 * R4 (design 3.6): the machine-wide prompt lock around `approve`, taken with zero wait. Null means another process is
 * already showing the one dialog, so this caller must not open a second. A pending `approve` keeps holding it; a holder
 * that died leaves a record that is stale at once and is reaped by the next taker.
 */
/**
 * Test seams: `beforePublish` runs between this caller's reservation and its publish (holding one copy there makes a race
 * deterministic); `removeRecord` replaces the release's unlink, so a test can observe what holds while it runs.
 */
export type PromptLockHooks = {
    readonly beforePublish?: () => Promise<void>;
    readonly removeRecord?: (path: string, record: string) => Promise<unknown>;
};
export declare function promptLockAt(path: string, hooks?: PromptLockHooks): () => Promise<(() => Promise<void>) | null>;
