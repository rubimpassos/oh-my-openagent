import { z } from "zod";
export type { CredentialOwner } from "./credential-owner";
declare const ownedCredentialSchema: z.ZodObject<{
    accessToken: z.ZodString;
    accessTokenExpiresAt: z.ZodString;
    refreshToken: z.ZodString;
    device: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    offlineGrant: z.ZodOptional<z.ZodString>;
    signingPrivateKey: z.ZodString;
    sealingPrivateKey: z.ZodString;
    refreshState: z.ZodOptional<z.ZodLiteral<"uncertain">>;
    credentialGeneration: z.ZodOptional<z.ZodString>;
    accountId: z.ZodOptional<z.ZodString>;
    owner: z.ZodObject<{
        accountId: z.ZodString;
        deviceId: z.ZodString;
        familyId: z.ZodString;
        generation: z.ZodNumber;
        ownerHandle: z.ZodString;
    }, z.core.$strip>;
    writerFloor: z.ZodLiteral<2>;
    refreshAttempt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type OwnedCredential = z.infer<typeof ownedCredentialSchema>;
