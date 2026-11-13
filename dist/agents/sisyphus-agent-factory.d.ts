import type { AgentConfig } from "@opencode-ai/sdk";
import type { AvailableAgent, AvailableCategory, AvailableSkill } from "./dynamic-agent-prompt-types";
import { type AgentMode } from "./types";
declare const MODE: AgentMode;
export declare function createSisyphusAgent(model: string, availableAgents?: AvailableAgent[], availableToolNames?: string[], availableSkills?: AvailableSkill[], availableCategories?: AvailableCategory[], useTaskSystem?: boolean): AgentConfig;
export declare namespace createSisyphusAgent {
    export { MODE as mode };
}
export {};
