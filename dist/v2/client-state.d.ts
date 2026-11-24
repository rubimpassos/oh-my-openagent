import type { TeamModeConfig } from "@oh-my-opencode/team-core/config";
import type { BackgroundTask } from "../features/background-agent/types";
import { type Goal } from "../hooks/goal/types";
export { startClientStatePublisher } from "./client-state-publisher";
export type ClientBackgroundTask = {
    id: string;
    description: string;
    agent: string;
    status: BackgroundTask["status"];
    sessionID?: string;
    category?: string;
    startedAt?: number;
    completedAt?: number;
    error?: string;
    toolCalls?: number;
    lastTool?: string;
    /** `providerID/modelID` of the attempt running now (or that ran last). */
    model?: string;
    /** One entry per model the task tried, oldest first; a retry adds one. */
    attempts?: ClientTaskAttempt[];
};
export type ClientTaskAttempt = {
    number: number;
    status: string;
    sessionID?: string;
    model?: string;
    error?: string;
    startedAt?: number;
    completedAt?: number;
};
/** A Prometheus plan Atlas is executing (`/ulw-execute`), for every session that works on it. */
export type ClientPlan = {
    workId: string;
    planName: string;
    planPath: string;
    status: string;
    total: number;
    completed: number;
    nextTask?: string;
    startedAt?: number;
    tasks: Array<{
        key: string;
        label: string;
        title: string;
        status: string;
        sessionID: string;
        agent?: string;
        category?: string;
    }>;
};
/** The `/goal` a session is pursuing (OMO's continuation loop). */
export type ClientGoal = Pick<Goal, "id" | "sessionID"> & {
    objective: string;
    status: "active" | "paused" | "complete" | "blocked" | "budgetLimited";
    tokensUsed: number;
    tokenBudget?: number;
    turnsUsed: number;
    timeUsedSeconds: number;
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
};
export type ClientTeamRun = {
    teamRunId: string;
    teamName: string;
    status: string;
    members: Array<{
        name: string;
        sessionID?: string;
        status: string;
        agentType: string;
        unread?: number;
    }>;
};
export declare function backgroundTasksByParent(tasks: readonly BackgroundTask[]): Record<string, ClientBackgroundTask[]>;
export declare function plansBySession(directory: string): Record<string, ClientPlan>;
export declare function goalsBySession(directory: string): Record<string, ClientGoal>;
export declare function teamRunsByLead(config: TeamModeConfig): Promise<Record<string, ClientTeamRun[]>>;
/** The OMO config files this instance loads, so a client can show or edit them. */
export declare function configPathsOf(directory: string): {
    userConfigPath: string;
    projectConfigPaths: string[];
};
