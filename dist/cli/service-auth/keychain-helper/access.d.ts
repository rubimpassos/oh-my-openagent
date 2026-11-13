import { type HelperCall, type HelperLease, type HelperReply, type HelperSpawner } from "./client";
import { type PinResult } from "./pin";
import { type SignatureVerdict } from "./signature";
export type HelperAccess = {
    readonly kind: "ready";
    readonly path: string;
    readonly call: (call: HelperCall, lease?: HelperLease) => Promise<HelperReply>;
} | {
    readonly kind: "missing";
} | {
    readonly kind: "invalid";
    readonly rejected: readonly string[];
} | {
    readonly kind: "unavailable";
    readonly reason: string;
};
/**
 * The only way the store reaches a helper process. The located copy is pinned (copied into this process's private
 * directory and verified there), and the pinned copy is checked again before EVERY spawn through the process's one
 * checker. So an unsigned, ad-hoc-signed or tampered file is never executed: not at resolution, not after a later
 * swap at the original path (never spawned), and not after a change to the pinned copy (refused).
 */
export declare function resolveHelperAccess(candidates: readonly string[], options?: {
    readonly verify?: (path: string) => Promise<SignatureVerdict>;
    readonly spawn?: HelperSpawner;
    readonly pin?: (source: string, verify: (path: string) => Promise<SignatureVerdict>) => Promise<PinResult>;
}): Promise<HelperAccess>;
