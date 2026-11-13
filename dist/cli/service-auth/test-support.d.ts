import type { SecretApi } from "./keystore";
export declare const grant: {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    offlineGrant: string;
    device: {
        id: string;
        name: string;
    };
};
export declare const privateKeys: {
    signingPrivateKey: string;
    sealingPrivateKey: string;
};
export declare const refusal: (code: string, detail?: unknown, status?: number) => Response;
export declare const limitDetail: {
    reason: string;
    managementToken: string;
    used: number;
    limit: number;
};
export declare function temporaryHome(): Promise<string>;
export declare function fakeApi(handler: (request: Request) => Response | Promise<Response>): string;
export declare function memorySecrets(): {
    api: SecretApi;
    values: Map<string, string>;
    writes: string[];
    store: (origin: string) => import("./keystore").CredentialStore;
};
export declare function clock(): {
    now: () => number;
    delays: number[];
    sleep: (ms: number) => Promise<void>;
};
export declare const minted: {
    deviceCode: string;
    userCode: string;
    matchingCode: string;
    verificationUri: string;
    expiresAt: string;
    intervalSeconds: number;
};
