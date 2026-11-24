import type { Plugin } from "@opencode/plugin";
import { type V1Handler } from "./hook-invocation";
export type ClientPresentation = {
    readonly surface: () => "terminal" | "chat";
};
export declare function registerContextHook(ctx: Plugin.Context, input: {
    readonly systemTransform?: V1Handler;
    readonly messagesTransform?: V1Handler;
    readonly chatParams?: V1Handler;
    readonly presentation?: ClientPresentation;
}): Promise<void>;
