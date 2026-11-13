/**
 * Runtime Fallback Hook - Constants
 *
 * Default values and configuration constants for the runtime fallback feature.
 */
import type { RuntimeFallbackConfig } from "../../config";
/**
 * First-prompt watchdog: how long to wait for the first sign of progress
 * (assistant text/reasoning/finish) from a subagent session before assuming
 * the provider is silently stuck and dispatching the configured fallback.
 *
 * Reasoning-heavy models and relays legitimately take longer than 90 s before
 * their first progress event (#11887), so this matches the 300 s stream-start
 * bound the engines themselves use; it stays well below the 30-minute outer
 * poll timeout. `runtime_fallback.first_prompt_timeout_seconds` overrides it.
 */
export declare const DEFAULT_FIRST_PROMPT_WATCHDOG_MS = 300000;
/**
 * Default configuration values for runtime fallback
 */
export declare const DEFAULT_CONFIG: Required<RuntimeFallbackConfig>;
/**
 * Error patterns that indicate rate limiting or temporary failures
 * These are checked in addition to HTTP status codes
 */
export declare const RETRYABLE_ERROR_PATTERNS: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
/**
 * Hook name for identification and logging
 */
export declare const HOOK_NAME = "runtime-fallback";
export declare const COMPACTION_WATCHDOG_BUDGET_MS = 600000;
