/**
 * Get the cache directory for oh-my-opencode binaries.
 * On Windows: Uses %LOCALAPPDATA% or %APPDATA% (Windows conventions)
 * On Unix: Follows XDG Base Directory Specification
 */
export declare function getCacheDir(): string;
/**
 * Get the binary name based on platform.
 */
export declare function getBinaryName(): string;
/**
 * Get the cached binary path if it exists and was recorded at the pinned release. The slot is shared
 * with the OmO Native edition and carries no version in its name, so an unrecorded or older binary is
 * left for the downloader to replace (#8850).
 */
export declare function getCachedBinaryPath(): string | null;
/**
 * Download the comment-checker binary from GitHub Releases.
 * Returns the path to the downloaded binary, or null on failure.
 */
export declare function downloadCommentChecker(): Promise<string | null>;
/**
 * Ensure the comment-checker binary is available.
 * First checks cache, then downloads if needed.
 * Returns the binary path or null if unavailable.
 */
export declare function ensureCommentCheckerBinary(): Promise<string | null>;
