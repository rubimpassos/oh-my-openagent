import type { TeamModeConfig } from "@oh-my-opencode/team-core/config";
import { type BackgroundTaskControl } from "../features/background-agent/task-registry";
import type { BackgroundTask } from "../features/background-agent/types";
export declare function startClientStatePublisher(input: {
    readonly stateDirectory: string;
    readonly teamMode?: TeamModeConfig;
    readonly intervalMs?: number;
    readonly owner: string;
    readonly readTasks?: () => readonly BackgroundTask[];
    readonly categories?: Record<string, string[]>;
    readonly control?: () => BackgroundTaskControl | undefined;
    readonly onStateChanged?: () => Promise<void> | void;
}): () => void;
