import { type DeviceKeyring } from "@oh-my-opencode/memory-core/keyring";
import type { KeyStore } from "./keystore";
/**
 * Generates the device's Ed25519 + X25519 pairs and a fresh random device id,
 * and stores all three in the OS keystore. Idempotent: an existing record is
 * reused untouched, so a repeated `omo account keys init` never rotates keys
 * or renames the principal out from under a synced account. The private
 * halves exist only inside the keystore record and this function's stack
 * frame; they are never logged and never returned.
 */
export declare function initializeDeviceKeyring(store: KeyStore): Promise<DeviceKeyring>;
/**
 * Reopens the stored device keyring, or null when none exists. A corrupt
 * record throws without ever echoing the stored bytes into the error.
 */
export declare function loadDeviceKeyring(store: KeyStore): Promise<DeviceKeyring | null>;
