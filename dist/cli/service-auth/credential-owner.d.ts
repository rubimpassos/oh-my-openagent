import { z } from "zod";
export declare const credentialOwnerSchema: z.ZodObject<{
    accountId: z.ZodString;
    deviceId: z.ZodString;
    familyId: z.ZodString;
    generation: z.ZodNumber;
    ownerHandle: z.ZodString;
}, z.core.$strip>;
export type CredentialOwner = z.infer<typeof credentialOwnerSchema>;
export declare const sameStableOwner: (left: CredentialOwner, right: CredentialOwner) => boolean;
