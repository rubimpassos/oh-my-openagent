/**
 * Resolve a write destination physically, including new parents. Never collapse
 * `link/..` textually: the parent is taken only after the link has been followed.
 * The returned absolute path must also be the path handed to the executor.
 */
export declare function resolveFileWritePath(filePath: string, cwd: string, followFinalSymlink?: boolean): string;
