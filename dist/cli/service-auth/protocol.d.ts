import { z } from "zod";
export declare class SignInError extends Error {
    readonly retryable: boolean;
    readonly name = "SignInError";
    constructor(message: string, retryable?: boolean);
}
export declare class RequestFailure extends SignInError {
    readonly notSent: boolean;
    readonly responseStatus?: number | undefined;
    constructor(notSent: boolean, responseStatus?: number | undefined);
}
export declare const platformSchema: z.ZodEnum<{
    linux: "linux";
    macos: "macos";
    windows: "windows";
}>;
export type Platform = z.infer<typeof platformSchema>;
export declare const tokenSchema: z.ZodObject<{
    accessToken: z.ZodString;
    accessTokenExpiresAt: z.ZodString;
    refreshToken: z.ZodString;
}, z.core.$strip>;
export declare const grantSchema: z.ZodObject<{
    accessToken: z.ZodString;
    accessTokenExpiresAt: z.ZodString;
    refreshToken: z.ZodString;
    device: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    offlineGrant: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodObject<{
        accountId: z.ZodString;
        deviceId: z.ZodString;
        familyId: z.ZodString;
        generation: z.ZodNumber;
        ownerHandle: z.ZodString;
    }, z.core.$strip>>;
    writerFloor: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>]>>;
    freshAuthorizationProof: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const credentialSchema: z.ZodObject<{
    accessToken: z.ZodString;
    accessTokenExpiresAt: z.ZodString;
    refreshToken: z.ZodString;
    device: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    offlineGrant: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodObject<{
        accountId: z.ZodString;
        deviceId: z.ZodString;
        familyId: z.ZodString;
        generation: z.ZodNumber;
        ownerHandle: z.ZodString;
    }, z.core.$strip>>;
    writerFloor: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>]>>;
    freshAuthorizationProof: z.ZodOptional<z.ZodString>;
    signingPrivateKey: z.ZodString;
    sealingPrivateKey: z.ZodString;
    refreshState: z.ZodOptional<z.ZodLiteral<"uncertain">>;
    credentialGeneration: z.ZodOptional<z.ZodString>;
    accountId: z.ZodOptional<z.ZodString>;
    refreshAttempt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type Credentials = z.infer<typeof credentialSchema>;
export declare const deviceCodeSchema: z.ZodObject<{
    deviceCode: z.ZodString;
    userCode: z.ZodString;
    matchingCode: z.ZodString;
    verificationUri: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodString>;
    expiresAt: z.ZodString;
    intervalSeconds: z.ZodNumber;
}, z.core.$strip>;
declare const limitSchema: z.ZodObject<{
    reason: z.ZodLiteral<"device_limit">;
    managementToken: z.ZodString;
    used: z.ZodNumber;
    limit: z.ZodNumber;
}, z.core.$strip>;
export declare const deviceListSchema: z.ZodObject<{
    devices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        revokedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ListedDevice = z.infer<typeof deviceListSchema>["devices"][number];
/** The one unrevoked device the calling token authenticates, or null when the list does not name exactly one. */
export declare function currentServiceDevice(body: unknown): string | null;
export type ChooseDevice = (devices: readonly ListedDevice[]) => Promise<string | null>;
declare const REFUSAL_CODES: readonly ["unauthorized", "account_deleted", "reauth_required", "invalid_grant", "device_revoked", "entitlement_required", "authorization_pending", "slow_down", "access_denied", "expired_token", "rate_limited", "internal", "unavailable", "forbidden", "invalid_request", "not_found", "client_upgrade_required", "writer_floor_mismatch", "service_upgrade_required", "refresh_recovery_expired", "machine_exists"];
export type RefusalCode = (typeof REFUSAL_CODES)[number] | "unknown";
/** What a refused request asks of the person; the message keys on this, never on the server's text. */
export type RefusalGuidance = "sign_in_again" | "wait" | "service_trouble" | "update_omo" | "account_deleted" | "account_refused" | "machine_exists";
export declare function refusalGuidance(code: RefusalCode, status: number): RefusalGuidance;
export declare function refusalMessage(guidance: RefusalGuidance): string;
export declare class ApiRefusal extends SignInError {
    #private;
    readonly status: number;
    readonly code: RefusalCode;
    constructor(code: string, status: number, detail?: z.infer<typeof limitSchema>, retryAfter?: string | null);
    get detail(): {
        reason: "device_limit";
        managementToken: string;
        used: number;
        limit: number;
    } | undefined;
    retryDelay(now: number, fallback: number): number;
}
export declare function parseReply<T>(schema: z.ZodType<T>, value: unknown): T;
export declare function serviceOrigin(value: string): string;
export declare function requestApi(api: string, path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown>;
export declare const jsonRequest: (body: unknown) => RequestInit;
export {};
