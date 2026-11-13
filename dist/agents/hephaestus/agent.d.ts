import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "../types";
import type { AvailableAgent, AvailableTool, AvailableSkill, AvailableCategory } from "../dynamic-agent-prompt-builder";
import { getNativePromptSource } from "../native-model-prompt";
declare const MODE: AgentMode;
export { isHephaestusSupportedModel, UnsupportedHephaestusModelError } from "./model-support";
export type HephaestusPromptSource = ReturnType<typeof getNativePromptSource>;
export declare function getHephaestusPromptSource(model?: string): HephaestusPromptSource;
export interface HephaestusContext {
    model?: string;
    availableAgents?: AvailableAgent[];
    availableTools?: AvailableTool[];
    availableSkills?: AvailableSkill[];
    availableCategories?: AvailableCategory[];
    useTaskSystem?: boolean;
}
export declare function getHephaestusPrompt(model?: string, useTaskSystem?: boolean): string;
export declare function createHephaestusAgent(model: string, availableAgents?: AvailableAgent[], availableToolNames?: string[], availableSkills?: AvailableSkill[], availableCategories?: AvailableCategory[], useTaskSystem?: boolean): AgentConfig;
export declare namespace createHephaestusAgent {
    export { MODE as mode };
}
export declare const hephaestusPromptMetadata: AgentPromptMetadata;
