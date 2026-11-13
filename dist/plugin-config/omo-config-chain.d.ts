import { type OmoConfigDiagnostic, type OmoConfigEnv, type OmoModelReferenceDiagnostic } from "@oh-my-opencode/omo-config-core";
export type OmoOpenCodeConfigView = {
    readonly config: Record<string, unknown>;
    /** Where the view sits in its file (`[opencode].`, `profiles.<P>.`), so a diagnostic names the full key. */
    readonly keyPrefix: string;
    readonly path: string;
    readonly scope?: "project" | "user";
};
export type OmoOpenCodeConfigChain = {
    readonly diagnostics: readonly (OmoConfigDiagnostic | OmoModelReferenceDiagnostic)[];
    readonly protectedUserView: Record<string, unknown>;
    readonly views: readonly OmoOpenCodeConfigView[];
};
export declare function loadOmoOpenCodeConfigChain(directory: string, environment?: OmoConfigEnv): OmoOpenCodeConfigChain;
