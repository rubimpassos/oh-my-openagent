/**
 * Arbitration between the runtime-fallback hook (same-session retry) and the
 * background manager (terminal error finalization) for one `session.error` event.
 *
 * The event dispatcher runs the background manager before runtime-fallback, and
 * runtime-fallback resolves its agent asynchronously before it decides anything,
 * so the manager cannot read runtime-fallback's state at the moment the error
 * arrives. Each `session.error` event therefore carries a claim: the dispatcher
 * opens it before any hook runs, runtime-fallback settles it once it has decided,
 * and the manager awaits it before finalizing the task.
 *
 * Claims are keyed by the event object, not by session or message id. Retry
 * prompts can reuse the original user message id, so neither a session id nor a
 * marker on a message can tell a stale error from the failure of the retry; the
 * event itself is the only identity that stays attached to one error.
 */
export type RuntimeFallbackRecoveryDecision = "retry-owned" | "declined" | "timed-out";
type SettledDecision = Exclude<RuntimeFallbackRecoveryDecision, "timed-out">;
/** Called by the runtime-fallback hook for its lifetime. Without an owner no claim is ever opened. */
export declare function registerRuntimeFallbackRecoveryOwner(): () => void;
/** Called by the event dispatcher before any hook sees the event. */
export declare function openRuntimeFallbackRecoveryClaim(event: object, sessionID: string): void;
/** Called by the runtime-fallback hook once it has finished handling the event. */
export declare function settleRuntimeFallbackRecoveryClaim(event: object, decision: SettledDecision): void;
/**
 * Called by consumers that would otherwise terminalize on the event. Returns
 * undefined when no claim was opened for it, so callers pay no extra await in
 * that case. A timeout is not a refusal: the hook may still commit a dispatch.
 * Consumers must not start competing recovery on `timed-out`.
 */
export declare function awaitRuntimeFallbackRecoveryDecision(event: object, timeoutMs?: number): Promise<RuntimeFallbackRecoveryDecision> | undefined;
/**
 * The decision the hook settles after a waiter already timed out. Resolves once the claim is settled,
 * including by the last owner's release, so a late `declined` can still finalize the task.
 */
export declare function awaitLateRuntimeFallbackRecoveryDecision(event: object): Promise<SettledDecision> | undefined;
export declare function _resetRuntimeFallbackRecoveryForTesting(): void;
export {};
