type ContinuationGuard = () => boolean;
type GoalSync = (sessionID: string, expectedGoalID: string) => Promise<void | ContinuationGuard>;
export declare function registerGoalSync(projectDir: string, sync: GoalSync): () => void;
export declare function registerGoalWake(projectDir: string, wake: (sessionID: string) => void): () => void;
/** The returned guard remains valid only for the same goal and client execution. */
export declare function syncGoalFromClient(projectDir: string, sessionID: string, expectedGoalID?: string): Promise<ContinuationGuard>;
/** Lets the loop continue a goal the user resumed; a no-op without a loop. */
export declare function wakeGoal(projectDir: string, sessionID: string): void;
export {};
