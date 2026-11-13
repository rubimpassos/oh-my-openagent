export declare const KEYCHAIN_HELPER_REQUIREMENT: string;
export type SignatureVerdict = "valid" | "invalid" | "missing";
/** Checks one file against a designated requirement. Injected in tests; production uses `verifyWithSecurityFramework`. */
export type RequirementCheck = (path: string, requirement: string) => Promise<boolean>;
export declare function signatureBackend(): Promise<"ffi" | "codesign">;
/** bun:ffi first, `/usr/bin/codesign --verify --strict -R=<DR>` when the framework cannot be loaded. */
export declare const verifyWithSecurityFramework: RequirementCheck;
/**
 * One verdict per file identity (dev, inode, size, mtime, ctime) per process (design 1, "Checking the helper"): a
 * replaced or rewritten file is checked again, an unchanged one is not. ctime moves on every write and cannot be set
 * back with utimes. The file is stat'ed before AND after the check, and a verdict is stored only when both agree, so it
 * is never recorded under the identity of a file that changed while it was being checked (that answers "invalid").
 */
export type SignatureChecker = (path: string) => Promise<SignatureVerdict>;
export declare function createSignatureChecker(check?: RequirementCheck, requirement?: string): SignatureChecker;
/** The one checker of this process: its verdict cache is shared by every resolution and every spawn. */
export declare const processSignatureChecker: () => SignatureChecker;
