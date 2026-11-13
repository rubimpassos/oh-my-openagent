import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode } from "../types";
import type { AgentOverrideConfig } from "../../config/schema";
import { getNativePromptSource } from "../native-model-prompt";
declare const MODE: AgentMode;
export declare const SISYPHUS_JUNIOR_DEFAULTS: {
    readonly model: "anthropic/claude-sonnet-5";
    readonly temperature: 0.1;
};
export type SisyphusJuniorPromptSource = ReturnType<typeof getNativePromptSource>;
export declare function buildSisyphusJuniorPrompt(model: string | undefined, useTaskSystem: boolean, promptAppend?: string): string;
export declare function createSisyphusJuniorAgentWithOverrides(override: AgentOverrideConfig | undefined, systemDefaultModel?: string, useTaskSystem?: boolean): AgentConfig;
export declare namespace createSisyphusJuniorAgentWithOverrides {
    export { MODE as mode };
}
export {};
