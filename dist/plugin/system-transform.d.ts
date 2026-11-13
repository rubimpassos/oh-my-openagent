import type { DefaultModeConfig } from "../config/schema/default-mode";
import type { NativePromptContext } from "../agents/native-prompt-frame";
type UltraworkRestoration = {
    getSystemTransformGuidance?: (sessionID: string, modelID?: string) => string | undefined;
};
export declare function createSystemTransformHandler(defaultMode?: DefaultModeConfig, getUltraworkMessage?: (agentName?: string, modelID?: string) => string, ultraworkRestoration?: UltraworkRestoration | null, getToolSnippets?: () => Record<string, string>, getSessionToolPermissions?: (sessionID?: string) => Promise<NativePromptContext["toolPermissions"]>): (input: {
    sessionID?: string;
    model: {
        id: string;
        providerID: string;
        [key: string]: unknown;
    };
}, output: {
    system: string[];
}) => Promise<void>;
export {};
