import type { Plugin } from "@opencode/plugin";
import type { AdapterState } from "./adapter-state";
import { type ClientPresentation } from "./context-hook";
type V2Context = Plugin.Context;
export type V1HookMap = Record<string, unknown>;
export declare function registerV1Hooks(ctx: V2Context, hooks: V1HookMap, state?: AdapterState, presentation?: ClientPresentation): Promise<() => void>;
export {};
