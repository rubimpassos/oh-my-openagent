import { type HelperCaller } from "./recovery";
/** Where the value about to be migrated came from; anything else is never migrated (3.3 table, addendum row 22). */
export type MigrationSource = "own-identity" | "owned-unmarked" | "approved";
export type MigrationOutcome = {
    readonly kind: "migrated";
    readonly oldDeleted: boolean;
} | {
    readonly kind: "skipped";
    readonly reason: "old-slots-full" | "not-migratable";
} | {
    readonly kind: "failed";
    readonly step: "stage" | "retire" | "promote";
};
/**
 * stage -> retire (`<A>` -> its first free `.old` slot) -> promote (staging -> `<A>`) -> delete that slot, all helper calls under the
 * session lock (3.6 R2), so at every instant `<A>`, `<A>.staging` or `<A>.old` holds the current value. It never throws
 * for a keychain refusal: the caller prints one notice and its section continues with the value it already read; 3.4
 * recovery converges whatever is left.
 */
export declare function migrate(account: string, value: string, source: string, helper: HelperCaller, deleteOwnOld: (name: string) => Promise<boolean>): Promise<MigrationOutcome>;
