import { type BuildDynamicSystemPromptOptions } from "@code-yeongyu/senpi/prompt-presets";
import { type NativePromptContext } from "./native-prompt-frame";
export declare function resolveNativePromptModel(model?: string): any;
export declare function getNativePromptSource(model?: string): string;
export declare function nativePromptOptions(selectedTools?: readonly string[], toolSnippets?: Readonly<Record<string, string>>, surface?: NativePromptContext["surface"]): BuildDynamicSystemPromptOptions;
/** The sole host transform; model-core prose is otherwise preserved byte for byte. */
export declare function adaptNativePrompt(prompt: string, useTaskSystem?: boolean): string;
export declare function buildNativeAgentPrompt(model: string | undefined, role: string, selectedTools?: readonly string[], restriction?: "hephaestus", useTaskSystem?: boolean, toolSnippets?: Record<string, string>, toolPermissions?: NativePromptContext["toolPermissions"], surface?: NativePromptContext["surface"]): string;
export declare function reconcileNativeModelPrompts(system: string[], model: string | undefined, toolSnippets?: Record<string, string>, toolPermissions?: NativePromptContext["toolPermissions"], runtimePermissions?: NativePromptContext["toolPermissions"], surface?: NativePromptContext["surface"]): void;
