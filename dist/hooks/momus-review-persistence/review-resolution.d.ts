import type { PluginInput } from "@opencode-ai/plugin";
import type { MomusReviewVerdict } from "../../features/boulder-state";
type OpencodeClient = PluginInput["client"];
export interface ReviewMetadata {
    agent?: string;
    prompt?: string;
    model?: string;
    sessionId?: string;
}
export interface SessionReviewContext {
    promptText?: string;
    model?: string;
    durationMs?: number;
}
export declare function parseMomusVerdict(outputText: string): MomusReviewVerdict | null;
export declare function extractMomusVerdictBlock(outputText: string): string | null;
export declare function extractSinglePlanPath(promptText: string): string | null;
export declare function readReviewMetadata(metadata: unknown, args?: Record<string, unknown>): ReviewMetadata;
export declare function resolveSessionReviewContext(client: OpencodeClient, sessionId: string): Promise<SessionReviewContext>;
export {};
