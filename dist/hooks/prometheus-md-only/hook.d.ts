import type { PluginInput } from "@opencode-ai/plugin";
export interface PrometheusExecutionArguments {
    readonly original: Record<string, unknown>;
    approved?: Record<string, unknown>;
}
export declare function createPrometheusMdOnlyHook(ctx: PluginInput): {
    "tool.execute.before": (input: {
        tool: string;
        sessionID: string;
        callID: string;
    }, output: {
        args: Record<string, unknown>;
        message?: string;
    }, execution: PrometheusExecutionArguments) => Promise<void>;
};
