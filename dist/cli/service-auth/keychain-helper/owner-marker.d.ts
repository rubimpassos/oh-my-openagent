export type MarkerProbe = (service: string, account: string, keychain?: string) => Promise<"helper-owned" | "other" | "absent" | "unknown">;
/**
 * Whether `<A>` carries the helper's `omo-owner/1` marker, read WITHOUT the helper (addendum row 9b): an attribute-only
 * `security find-generic-password` lookup. It never passes `-w`/`-g`, so the secret is never read and no dialog can
 * appear (attribute reads are silent for any identity, design 8 m2).
 */
export declare const probeOwnerMarker: MarkerProbe;
