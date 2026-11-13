import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../../shared/logger";
import { type NudgeStateStore } from "./state";
export declare const NATIVE_NUDGE_TOAST_TITLE = "OmO Native";
export declare const NATIVE_NUDGE_TOAST_MESSAGE = "OmO Native - the OmO agent runtime as one binary, no host app needed. Get it at https://omo.dev";
export declare function nativeEditionStateDir(): string;
export declare function detectNativeEdition(): boolean;
export declare function isInteractiveLaunch(env: NodeJS.ProcessEnv, stdoutIsTTY: boolean | undefined): boolean;
type NativeEditionNudgeDeps = {
    readonly store?: NudgeStateStore;
    readonly detectNativeEdition?: () => boolean;
    readonly now?: () => number;
    readonly interactive?: () => boolean;
    readonly version?: string;
    readonly log?: typeof log;
};
export declare function createNativeEditionNudgeHook(ctx: PluginInput, deps?: NativeEditionNudgeDeps): {
    event: ({ event }: {
        event: {
            type: string;
            properties?: unknown;
        };
    }) => Promise<void>;
};
export {};
