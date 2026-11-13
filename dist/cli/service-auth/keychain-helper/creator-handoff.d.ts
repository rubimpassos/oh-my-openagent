import type { RequirementCheck } from "./signature";
export declare const DESKTOP_RUNTIME_REQUIREMENT = "identifier \"com.mengmota.omo-desktop-runtime\" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] and certificate leaf[field.1.2.840.113635.100.6.1.13] and certificate leaf[subject.OU] = \"523JNR86LZ\"";
/** The app bundle as a whole: any Developer ID signature of our team, with every nested piece sealed (--deep --strict). */
export declare const DESKTOP_APP_REQUIREMENT = "anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] and certificate leaf[field.1.2.840.113635.100.6.1.13] and certificate leaf[subject.OU] = \"523JNR86LZ\"";
/** Set in the creator's environment: that process never hands off in turn and never shows a keychain dialog. */
export declare const HANDOFF_ENV = "OMO_KEYCHAIN_HANDOFF";
export type DesktopRuntime = {
    readonly app: string;
    readonly runtime: string;
};
/** The desktop app's macOS install locations, joined with POSIX separators on every host. */
export declare function desktopRuntimeCandidates(home: string, arch?: string): readonly DesktopRuntime[];
export type BundleCheck = (app: string, requirement: string) => Promise<boolean>;
export type HandOffRunner = (path: string, args: readonly string[], env: Record<string, string>, deadlineMs: number) => Promise<number | null>;
/**
 * Addendum change 1 (rows 7, 8): before the one dialog, ask the side that created the item to move it to the helper.
 * The runtime is run from inside its app bundle, never from a copy: it finds its own keychain helper next to itself,
 * which is what lets it migrate. So the whole bundle is verified (`codesign --deep --strict` against our team) and the
 * runtime against its designated requirement immediately before the spawn. True only when a verified creator exited
 * cleanly; a missing app, a failed check, a failed spawn or a non-zero exit is false, and the caller shows its dialog.
 */
export declare function createCreatorHandOff(options: {
    readonly candidates: readonly DesktopRuntime[];
    readonly origin?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly checkRuntime?: RequirementCheck;
    readonly checkBundle?: BundleCheck;
    readonly declaresHandOff?: (runtime: string) => Promise<boolean>;
    readonly run?: HandOffRunner;
    readonly selfPath?: string;
}): () => Promise<boolean>;
