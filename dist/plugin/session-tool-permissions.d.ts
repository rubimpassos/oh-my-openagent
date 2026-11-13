import type { NativePromptContext } from "../agents/native-prompt-frame";
import type { PluginContext } from "./types";
type ToolPermissions = NonNullable<NativePromptContext["toolPermissions"]>;
export declare function createSessionToolPermissionLookup(ctx: PluginContext): {
    lookup: (sessionID?: string) => Promise<ToolPermissions | undefined>;
    observe: (input: {
        event: unknown;
    }) => void;
};
export {};
