/** Return the authorized physical content path or final entry that execution must use. */
export declare function resolveAllowedFile(filePath: string, workspaceRoot: string, mode?: "content" | "entry"): string | undefined;
export declare function isAllowedFile(filePath: string, workspaceRoot: string): boolean;
