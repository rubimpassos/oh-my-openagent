import type { createPrometheusMdOnlyHook } from "../hook";
type Before = ReturnType<typeof createPrometheusMdOnlyHook>["tool.execute.before"];
/** Invoke the hook the way tool-execute-before.ts does: with the host's retained args reference. */
export declare function invokeBefore(hook: {
    "tool.execute.before": Before;
}, input: Parameters<Before>[0], output: Parameters<Before>[1]): Promise<void>;
export {};
