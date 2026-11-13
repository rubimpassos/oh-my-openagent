import type { Command } from "commander";
import { type KeyStore } from "./keystore";
export declare const ACCOUNT_KEYS_RECORD_NAME = "device-keys-v1";
export interface AccountKeysDependencies {
    readonly store: () => KeyStore;
    readonly output: (line: string) => void;
}
export declare function configureAccountKeysCommands(program: Command, dependencies?: AccountKeysDependencies): void;
export declare function runAccountKeysCommand(args: readonly string[]): Promise<void>;
