import type { ShellType } from "./shell-env";
/**
 * The shell OpenCode's bash tool will actually run, mirrored from OpenCode's
 * `Shell.acceptable(cfg.shell)` (packages/core/src/shell.ts, stable since 1.4.0;
 * `cfg.shell` is honored from 1.14.27). Command prefixes must use this shell's
 * syntax: inferring it from ComSpec picks cmd on machines where OpenCode runs
 * PowerShell (#9733).
 *
 * Order: the configured `shell`, else `$SHELL`, when it is not fish/nu and
 * resolves to a file; otherwise on Windows the first of pwsh, powershell,
 * Git Bash, then COMSPEC (or cmd.exe); elsewhere /bin/zsh on macOS, then bash,
 * then /bin/sh.
 */
export interface OpenCodeShellHost {
    readonly platform: NodeJS.Platform;
    readonly env: NodeJS.ProcessEnv;
    readonly isFile: (file: string) => boolean;
}
export declare function openCodeShellName(file: string, host?: OpenCodeShellHost): string;
export declare function resolveOpenCodeShell(configShell: string | undefined, host?: OpenCodeShellHost): string;
export declare function shellTypeForOpenCodeShell(shellPath: string, host?: OpenCodeShellHost): ShellType;
export interface OpenCodeShellTypeResolver {
    setConfiguredShell(shell: unknown): void;
    resolveShellType(): ShellType;
}
export declare function createOpenCodeShellTypeResolver(host?: () => OpenCodeShellHost): OpenCodeShellTypeResolver;
export declare const openCodeShellTypeResolver: OpenCodeShellTypeResolver;
