import type { HelperCall, HelperReply } from "./client";
export type MigrationNames = {
    readonly original: boolean;
    readonly staging: boolean;
    readonly old: boolean;
    readonly oldSlots: readonly number[];
};
/** `<A>.old` is slot 0; retired copies rotate through `<A>.old.1` ... `<A>.old.7` (RULING-73). */
export declare const OLD_SLOT_COUNT = 8;
export declare const oldSlotName: (account: string, slot: number) => string;
export type RecoveryStep = "promote" | "remove-staging" | "delete-old";
/**
 * The 3.4 table: what one locked section does for each leftover of an interrupted migration. Renames only, never
 * interactive, and `.old` is never renamed back: an `.old` with no original and no staging means signed out.
 */
export declare function recoveryPlan(names: MigrationNames): readonly RecoveryStep[];
/** The occupied old slots; a helper that predates `oldSlots` has only slot 0 (`.old`). */
export declare function oldSlotsOf(reply: HelperReply): readonly number[];
/** The names present, from one `read` reply (its `present` field comes from silent attribute reads). */
export declare function namesFromRead(reply: HelperReply): MigrationNames;
export type HelperCaller = (call: HelperCall) => Promise<HelperReply>;
/**
 * Deletes one retired copy with whichever identity can: the helper when it can read it, otherwise this process's own
 * identity (a decrypt-list member deletes silently, m9). A copy neither can delete is left; it holds a single-use token
 * that the next refresh retires, and it occupies one rotation slot.
 */
export declare function deleteOld(name: string, helper: HelperCaller, deleteOwn: (name: string) => Promise<boolean>): Promise<boolean>;
/** Clears every retired slot that is present and that some identity here can delete; true when none is left. */
export declare function deleteOldSlots(account: string, slots: readonly number[], helper: HelperCaller, deleteOwn: (name: string) => Promise<boolean>): Promise<boolean>;
export type RecoveryOutcome = {
    readonly applied: readonly RecoveryStep[];
    readonly failed: RecoveryStep | null;
};
export declare function runRecovery(account: string, names: MigrationNames, helper: HelperCaller, deleteOwnOld: (name: string) => Promise<boolean>): Promise<RecoveryOutcome>;
