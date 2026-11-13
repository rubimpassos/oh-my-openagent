import type { CredentialOwner } from "./credential-owner";
import { type CredentialStore, type LockedStore } from "./keystore";
import { type ChooseDevice, type Credentials, SignInError } from "./protocol";
export declare class SessionEnded extends SignInError {
    readonly deviceRevoked: boolean;
    readonly code: string;
    constructor(message: string, deviceRevoked: boolean, code: string);
}
/**
 * A stored principal whose private keys are about to be discarded (#12280), or a stored item that
 * could not be read when a save replaced it. The hook retires that principal's memory-sync pin; it
 * never throws, so a failure to retire never blocks the discard.
 */
export type DiscardedCredential = {
    readonly kind: "credential";
    readonly deviceId: string;
    readonly accountId: string | undefined;
    readonly owner: CredentialOwner | undefined;
    readonly cause: "refused" | "forget" | "logout" | "replaced";
} | {
    readonly kind: "unreadable";
};
export type BeforeKeysDiscarded = ((discarded: DiscardedCredential) => Promise<void>) & {
    /** Whether a sign-in that names no account should have it read before logout revokes the device. */
    readonly wantsAccount?: () => Promise<boolean>;
};
/**
 * This machine's device service, told about the sign-in from memory (design D r9 sections 4-5): `adopt` gets a fresh
 * sign-in's credential after the signed-out marker is gone, `forget` runs at every local end of a sign-in (logout on
 * every path, forget, a session the service ended). Neither ever reads the credential store, and neither throws: a
 * device service that is down or refuses never fails a sign-in or a sign-out.
 */
export type MachineDeviceState = {
    readonly kind: "absent";
} | {
    readonly kind: "held";
    readonly device: {
        readonly id: string;
        readonly name: string;
    };
} | {
    readonly kind: "unknown";
    readonly reason: string;
};
export type DeviceServiceHandoff = {
    readonly adopt: (credentials: Credentials) => Promise<void>;
    readonly forget: () => Promise<void>;
    /**
     * What this machine's device service holds (#6503): `absent` only when no service runs or it holds no device;
     * `held` includes a parked device (sign_in_required); `unknown` is a service that exists but could not be read.
     */
    readonly machineDevice?: () => Promise<MachineDeviceState>;
};
export declare const discardedOf: (credentials: Credentials, cause: "refused" | "forget" | "logout" | "replaced") => DiscardedCredential;
export declare function createSession(options: {
    readonly api: string;
    readonly store: CredentialStore;
    readonly home?: string;
    readonly signal?: AbortSignal;
    readonly now?: () => number;
    /** Runs inside the credential lock immediately before a stored principal's keys are discarded. */
    readonly beforeKeysDiscarded: BeforeKeysDiscarded;
    /** This machine's device service; absent, no device service is told anything. */
    readonly deviceService?: DeviceServiceHandoff;
}): {
    request: (path: string, init: RequestInit) => Promise<unknown>;
    signal: AbortSignal | undefined;
    transaction: <T>(action: (view: LockedStore<Credentials> | null) => Promise<T>) => Promise<T>;
    ready(): Promise<void>;
    save(value: Credentials): Promise<void>;
    /** The marker an explicit `omo logout` left, or null; only an empty store makes it meaningful. */
    signedOutMarker: () => Promise<{
        device: string | null;
        at: string;
    } | null>;
    clearSignedOutMarker: () => Promise<void>;
    update<T>(action: (current: Credentials | null) => Promise<T>, options?: {
        readonly replaceInvalid?: boolean;
    }): Promise<T>;
    /**
     * Deletes the item without reading it (a corrupt or locked item must still be removable, with one
     * native call), so it cannot name the account whose pin to retire: `omo account forget --device`
     * and `logout` read first and retire; this one leaves the pin (a stale pin is harmless for keys).
     */
    forget(): Promise<void>;
    accessSnapshot: () => Promise<Credentials | null>;
    logout(): Promise<boolean>;
    /** `expect` rejects a stored credential that is no longer the caller's captured identity before any refresh. */
    accessToken(expect?: (current: Credentials) => boolean): Promise<string>;
    removeForLimit(error: unknown, choose: ChooseDevice): Promise<boolean>;
};
export type Session = ReturnType<typeof createSession>;
