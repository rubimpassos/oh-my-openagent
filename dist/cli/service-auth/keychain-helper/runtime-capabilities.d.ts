/**
 * What a built omo runtime declares about itself (RULING-74), in a file beside the runtime binary. The release build
 * writes it next to every runtime it produces, and the desktop bundles it with the runtime and its keychain helper,
 * inside the sealed app. A runtime from before this contract has no such file.
 */
export declare const RUNTIME_CAPABILITIES_FILE = "omo-runtime-capabilities.json";
/** keychainHandoff 1: honours OMO_KEYCHAIN_HANDOFF (never shows a keychain dialog) and migrates through its helper. */
export declare const RUNTIME_CAPABILITIES: {
    readonly keychainHandoff: 1;
};
export declare function runtimeCapabilitiesText(): string;
/** True only when the file beside `runtime` parses and declares keychain hand-off support at level 1 or above. */
export declare function runtimeDeclaresKeychainHandoff(runtime: string): Promise<boolean>;
