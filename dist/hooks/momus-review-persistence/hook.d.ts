import type { PluginInput } from "@opencode-ai/plugin";
interface ToolExecuteInput {
    tool: string;
    sessionID: string;
    callID: string;
    args?: Record<string, unknown>;
}
interface ToolExecuteOutput {
    title: string;
    output: string;
    metadata: unknown;
}
export declare function createMomusReviewPersistenceHook(ctx: PluginInput): {
    "tool.execute.before": (input: ToolExecuteInput, _output: {
        args: Record<string, unknown>;
    }) => Promise<void>;
    "tool.execute.after": (input: ToolExecuteInput, output: ToolExecuteOutput) => Promise<void>;
};
export {};
