export declare const MAX_OBJECTIVE_LENGTH = 2000;
export declare class InvalidObjectiveError extends Error {
    constructor(message: string);
}
export declare function validateObjective(objective: string): string;
