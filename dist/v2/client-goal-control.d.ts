import type { ClientGoalControl, ClientGoalControlResult } from "./client-api-contract";
export type ClientSessionReader = {
    readonly get: (input: {
        readonly sessionID: string;
    }) => Promise<{
        readonly location: {
            readonly directory: string;
        };
    }>;
};
export declare function createClientGoalControl(input: {
    readonly owner: string;
    readonly goalEnabled: boolean;
    readonly session: ClientSessionReader;
}): (request: ClientGoalControl, current?: () => boolean) => Promise<ClientGoalControlResult>;
