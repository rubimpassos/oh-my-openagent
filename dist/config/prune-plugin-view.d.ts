import type * as z from "zod";
export type PrunedPluginView = {
    readonly config: Record<string, unknown>;
    /** Plugin-schema issues left standing: non-empty only when the view could not be pruned into shape. */
    readonly issues: readonly z.core.$ZodIssue[];
    readonly warnings: readonly string[];
};
/**
 * Drop only the values of one OpenCode view that fail the plugin schema, with one warning per
 * dropped key named by its dotted path in the file (`keyPrefix` places a harness-block or profile
 * view inside it). A view that cannot be pruned into shape is returned as-is with its issues.
 */
export declare function prunePluginView(input: {
    readonly config: Record<string, unknown>;
    readonly homeDir: string | undefined;
    readonly keyPrefix: string;
    readonly path: string;
}): PrunedPluginView;
