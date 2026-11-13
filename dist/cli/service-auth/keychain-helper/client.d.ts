import { z } from "zod";
export type HelperVerb = "read" | "approve" | "write" | "stage" | "retire" | "promote" | "remove";
export type HelperCall = {
    readonly verb: HelperVerb;
    readonly account: string;
    readonly value?: string;
};
declare const helperReplySchema: z.ZodObject<{
    owned: z.ZodOptional<z.ZodBoolean>;
    value: z.ZodOptional<z.ZodString>;
    marker: z.ZodOptional<z.ZodBoolean>;
    cdat: z.ZodOptional<z.ZodNumber>;
    mdat: z.ZodOptional<z.ZodNumber>;
    partition: z.ZodOptional<z.ZodEnum<{
        none: "none";
        other: "other";
        ours: "ours";
        unknown: "unknown";
    }>>;
    present: z.ZodOptional<z.ZodObject<{
        staging: z.ZodBoolean;
        old: z.ZodBoolean;
        oldSlots: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>>;
    missing: z.ZodOptional<z.ZodBoolean>;
    recover: z.ZodOptional<z.ZodBoolean>;
    ok: z.ZodOptional<z.ZodBoolean>;
    created: z.ZodOptional<z.ZodBoolean>;
    skipped: z.ZodOptional<z.ZodBoolean>;
    slot: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodEnum<{
        denied: "denied";
        exists: "exists";
        locked: "locked";
        missing: "missing";
        "not-owned": "not-owned";
        refused: "refused";
        store: "store";
    }>>;
    reason: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type HelperReply = z.infer<typeof helperReplySchema>;
/** The session-lock lease of team-core (`withLock`'s callback argument), narrowed to what a helper call needs. */
export type HelperLease = {
    readonly handOver: (pid: number) => Promise<void>;
    readonly restore: () => Promise<void>;
};
export type SpawnedHelper = {
    readonly pid: number;
    readonly send: (line: string) => void;
    readonly reply: Promise<string | null>;
    readonly close: () => void;
};
export type HelperSpawner = (path: string) => SpawnedHelper;
export declare class HelperProtocolError extends Error {
}
export declare const spawnDetachedHelper: HelperSpawner;
/**
 * One helper process per call. A mutating call runs only under the session lock: the lock is handed to the helper
 * before the request and restored before its stdin closes, so no other writer can enter until the native call has
 * landed (design 3.6, R2). `restore` throws when the lock was lost, and the caller's section must stop.
 */
export declare function callHelper(path: string, call: HelperCall, options?: {
    readonly lease?: HelperLease;
    readonly spawn?: HelperSpawner;
}): Promise<HelperReply>;
export {};
