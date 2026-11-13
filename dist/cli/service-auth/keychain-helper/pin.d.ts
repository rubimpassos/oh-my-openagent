import type { SignatureVerdict } from "./signature";
/** Removes the pin directories of processes that are gone (a crash skips the exit cleanup). A live owner's is kept. */
export declare function sweepDeadPinDirs(root?: string): readonly string[];
export type PinResult = {
    readonly kind: "pinned";
    readonly path: string;
} | {
    readonly kind: "invalid";
} | {
    readonly kind: "unavailable";
    readonly reason: string;
};
/**
 * Copies a located helper into a directory only this process uses, makes the copy read-only, and verifies the COPY.
 * The process then spawns only that copy, so a file written to the original path later (a dev build, a broken
 * install) is never executed. The signature is inside the Mach-O, so the copy has the same designated requirement and
 * the same keychain access as the original (#11262 design 1: every copy at any path matches one ACL entry).
 * One copy is kept per source file identity; a source that changes gets a fresh copy.
 */
export declare function pinVerifiedCopy(source: string, verify: (path: string) => Promise<SignatureVerdict>, dir?: string): Promise<PinResult>;
