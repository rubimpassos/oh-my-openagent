import type { PluginInput } from "@opencode-ai/plugin";
import type { ShellType } from "../../shared/shell-env";
export * from "./constants";
export * from "./detector";
export * from "./types";
export interface NonInteractiveEnvHookDeps {
    readonly resolveShellType: () => ShellType;
}
export declare function createNonInteractiveEnvHook(_ctx: PluginInput, deps?: NonInteractiveEnvHookDeps): {
    "tool.execute.before": (input: {
        tool: string;
        sessionID: string;
        callID: string;
    }, output: {
        args: Record<string, unknown>;
        message?: string;
    }) => Promise<void>;
};
