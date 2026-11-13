import { z } from "zod";
import type { RecoveryClockReading } from "./recovery-clock";
import { sameStableOwner, type CredentialOwner } from "./credential-owner";
export type { CredentialOwner } from "./credential-owner";
export declare const REFRESH_SEND_BUDGET_MS: number;
declare const refreshAttemptSchema: z.ZodObject<{
    writerProtocol: z.ZodLiteral<2>;
    origin: z.ZodString;
    owner: z.ZodObject<{
        accountId: z.ZodString;
        deviceId: z.ZodString;
        familyId: z.ZodString;
        generation: z.ZodNumber;
        ownerHandle: z.ZodString;
    }, z.core.$strip>;
    refreshTokenHash: z.ZodString;
    idempotencyKey: z.ZodString;
    firstSend: z.ZodObject<{
        wallTimeMs: z.ZodNumber;
        continuousTimeMs: z.ZodNumber;
        bootId: z.ZodString;
    }, z.core.$strip>;
    deadline: z.ZodNumber;
    state: z.ZodEnum<{
        exhausted: "exhausted";
        ready: "ready";
        sent_unknown: "sent_unknown";
        successor_received_uncommitted: "successor_received_uncommitted";
    }>;
}, z.core.$strip>;
export type RefreshAttempt = z.infer<typeof refreshAttemptSchema>;
export declare const sameOwner: typeof sameStableOwner;
export declare function newRefreshAttempt(origin: string, owner: CredentialOwner, token: string, reading: RecoveryClockReading, idempotencyKey?: string): RefreshAttempt;
export declare function eligibleAttempt(raw: unknown, origin: string, owner: CredentialOwner, token: string, reading: RecoveryClockReading | null): RefreshAttempt | null;
