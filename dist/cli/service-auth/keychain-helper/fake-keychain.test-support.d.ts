import { type SecretApi } from "../keystore";
import type { Credentials } from "../protocol";
import { type BeforeKeysDiscarded } from "../session";
import type { HelperCall, HelperLease, HelperReply } from "./client";
export type Owner = "helper" | "bun" | "runtime" | "other-app";
type Item = {
    value: string;
    owner: Owner;
    partition: "ours" | "other" | "none";
    marker: boolean;
    cdat: number;
    mdat: number;
};
export declare const credentials: Credentials;
export declare const API = "https://api.example.test";
export declare const A: string;
/**
 * An in-memory keychain with the measured semantics of #11262 design 8: data reads by a non-owner are refused, an
 * overwrite keeps the item's owner (m5), a rename works for anyone (m10), a delete by a non-owner is refused (m6).
 * `secrets` is this process's own identity (`bun`); `access` is the signed helper, which counts every approve dialog.
 */
export declare function fakeKeychain(options?: {
    readonly approve?: "allow" | "deny" | "locked";
    readonly approveGate?: Promise<void>;
    readonly onApprove?: () => void;
    readonly failReadWhenMissing?: boolean;
    readonly singleOldSlot?: boolean;
}): {
    items: Map<string, Item>;
    events: string[];
    stats: {
        approves: number;
        unleasedMutations: number;
    };
    secrets: SecretApi;
    secretsAs: (identity: Owner) => SecretApi;
    access: {
        readonly kind: "ready";
        readonly path: string;
        readonly call: (call: HelperCall, lease?: HelperLease) => Promise<HelperReply>;
    };
    put: (name: string, value: string, owner: Owner, partition?: Item["partition"]) => Map<string, Item>;
    cache: {
        consume(current: import("./approval-cache").ItemAttributes): string | null;
        deniedForBackground: () => boolean;
        inFlight: () => Promise<import("./approval-cache").ApprovalAnswer> | null;
        approve(run: () => Promise<import("./approval-cache").ApprovalAnswer>): Promise<import("./approval-cache").ApprovalAnswer>;
        afterOwnWrite(value: string, readAttributes: () => Promise<import("./approval-cache").ItemAttributes | null>): Promise<void>;
        drop(): void;
    };
};
export type SessionProcess = {
    readonly identity?: Owner;
    readonly noDialog?: boolean;
    readonly handOff?: () => Promise<boolean>;
    readonly home?: string;
    readonly api?: string;
    readonly beforeKeysDiscarded?: BeforeKeysDiscarded;
};
/** One omo process on the fake machine; a process other than the default has its own approval cache, as a real one does. */
export declare function helperSession(keychain: ReturnType<typeof fakeKeychain>, background?: boolean, proc?: SessionProcess): Promise<{
    store: import("..").CredentialStore;
    session: {
        request: (path: string, init: RequestInit) => Promise<unknown>;
        signal: AbortSignal | undefined;
        transaction: <T>(action: (view: import("./store-binding").LockedStore<Credentials> | null) => Promise<T>) => Promise<T>;
        ready(): Promise<void>;
        save(value: Credentials): Promise<void>;
        signedOutMarker: () => Promise<{
            device: string | null;
            at: string;
        } | null>;
        clearSignedOutMarker: () => Promise<void>;
        update<T>(action: (current: Credentials | null) => Promise<T>, options?: {
            readonly replaceInvalid?: boolean;
        }): Promise<T>;
        forget(): Promise<void>;
        accessSnapshot: () => Promise<Credentials | null>;
        logout(): Promise<boolean>;
        accessToken(expect?: (current: Credentials) => boolean): Promise<string>;
        removeForLimit(error: unknown, choose: import("../protocol").ChooseDevice): Promise<boolean>;
    };
    home: string;
}>;
export {};
