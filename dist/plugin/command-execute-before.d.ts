import type { CreatedHooks } from "../create-hooks";
import type { SkillMcpManager } from "../features/skill-mcp-manager";
type CommandExecuteBeforeInput = {
    command: string;
    sessionID: string;
    arguments: string;
};
type CommandExecuteBeforeOutput = {
    parts: Array<{
        type: string;
        text?: string;
        [key: string]: unknown;
    }>;
};
export declare function markNativeGoalCommand(parts: CommandExecuteBeforeOutput["parts"]): void;
export declare function consumeNativeGoalCommandMarker(parts: CommandExecuteBeforeOutput["parts"]): boolean;
export declare function createCommandExecuteBeforeHandler(args: {
    directory: string;
    hooks: CreatedHooks;
    mcpManager?: SkillMcpManager;
    notify?: (message: string) => void;
}): (input: CommandExecuteBeforeInput, output: CommandExecuteBeforeOutput) => Promise<void>;
export {};
