import { z } from "zod";
import type { BackgroundTaskControl } from "../features/background-agent/task-registry";
import type { BackgroundTask } from "../features/background-agent/types";
import { clientRpc, type ClientApiFailure } from "./client-api-contract";
/**
 * Version of the `.omo/v2-state` files. A client that needs a newer one tells
 * the user to update the plugin instead of showing empty lists.
 */
export declare const CLIENT_STATE_SCHEMA = 2;
export type ClientHealth = {
    /** Each category's model chain: the first model, then its fallbacks. */
    categories: Record<string, string[]>;
    /** Providers whose background attempts failed recently, worst first. */
    providers: Array<{
        provider: string;
        failures: number;
        lastError: string;
        lastModel: string;
        lastAt: number;
    }>;
};
/** `categories` as configured: `models` (string or `{ model }`), else the deprecated `model` + `fallback_models`. */
export declare function categoryModels(categories: unknown): Record<string, string[]>;
/** Failed background attempts of the last hour, grouped by provider. */
export declare function providerHealth(tasks: readonly BackgroundTask[], now: number): ClientHealth["providers"];
/**
 * A client asks for an action by writing `requests/<id>.json` next to the
 * state files; the plugin runs it, deletes the file and records the outcome in
 * `results.json`. Only these actions exist, on tasks of this plugin instance.
 */
declare const RequestSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    action: z.ZodLiteral<"cancel">;
    taskId: z.ZodString;
    id: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"retry">;
    taskId: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
}, z.core.$strict>], "action">;
export type ClientRequest = z.infer<typeof RequestSchema>;
export type ClientRequestResult = {
    ok: boolean;
    message: string;
    at: number;
    action: string;
    taskId: string;
};
type TaskRequest = z.infer<typeof clientRpc.methods.controlTask.input>;
type TaskResult = {
    readonly ok: true;
    readonly message: string;
} | (ClientApiFailure & {
    readonly message: string;
});
export declare function runClientRequest(request: TaskRequest, control: BackgroundTaskControl, current?: () => boolean): Promise<TaskResult>;
/** Runs and removes every pending request file; returns how many ran. */
export declare function processClientRequests(stateDirectory: string, control: BackgroundTaskControl | undefined): Promise<number>;
export {};
