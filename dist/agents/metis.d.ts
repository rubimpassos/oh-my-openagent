import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "./types";
declare const MODE: AgentMode;
export declare function createMetisAgent(model: string): AgentConfig;
export declare namespace createMetisAgent {
    export { MODE as mode };
}
export declare const metisPromptMetadata: AgentPromptMetadata;
export {};
