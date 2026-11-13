import type { SecretApi } from "../keystore";
import type { HelperLease } from "./client";
import { type DarwinBackend, type KeychainHelperOptions } from "./darwin-backend";
import type { WriteIntent } from "./darwin-store";
/** The session-lock view of a store (#11262 design 3.3, 3.4, 3.6): every keychain change inside one locked section. */
export type LockedStore<T> = {
    readonly read: () => Promise<T | null>;
    readonly write: (value: T, intent?: WriteIntent, beforeRetire?: () => Promise<void>) => Promise<void>;
    readonly clear: () => Promise<void>;
    readonly recover: () => Promise<void>;
    readonly settle: () => Promise<void>;
};
export type HelperBinding = {
    /** The secrets every non-helper path of this store uses: gated when the store is helper-eligible, else as given. */
    readonly secrets: SecretApi;
    readonly eligible: boolean;
    readonly backend: () => Promise<DarwinBackend | null>;
    readonly reader: (backend: DarwinBackend) => SecretApi;
    readonly isHelperReader: (api: SecretApi) => boolean;
    readonly guardHelperless: () => Promise<void>;
};
/**
 * Only the real macOS store of the sign-in item gets the signed helper (or a store a test hands helper options to);
 * Windows, Linux, the other namespaces and injected stores keep exactly today's path.
 */
export declare function bindKeychainHelper(input: {
    readonly platform: NodeJS.Platform;
    readonly namespace: string;
    readonly secrets: SecretApi;
    readonly key: {
        readonly service: string;
        readonly name: string;
    };
    readonly background: boolean;
    readonly origin: string;
    readonly notice: (message: string) => void;
    readonly pending: (message: string) => Error;
    readonly options?: KeychainHelperOptions;
}): HelperBinding;
/** Adapts the helper's locked view to the store's value type; every error is mapped once and the shared read reset. */
export declare function lockedStoreView<T>(helper: DarwinBackend, lease: HelperLease, codec: {
    readonly parse: (text: string) => T;
    readonly serialize: (value: T) => string;
    /** Assigns derived fields (the credential generation) from the item as a read started now finds it. */
    readonly amend?: (previous: string | null, next: T) => T;
}, mapError: (error: unknown) => unknown, done: () => void): LockedStore<T>;
