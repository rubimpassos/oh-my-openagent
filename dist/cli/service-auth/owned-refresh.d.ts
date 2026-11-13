import { SignInError } from "./protocol";
import { type RefreshAttempt } from "./refresh-attempt";
import { type RecoveryClock } from "./recovery-clock";
import type { OwnedCredential } from "./protocol-v2";
export type { OwnedCredential } from "./protocol-v2";
export declare class RecoveryExhausted extends SignInError {
    readonly code = "refresh_recovery_expired";
    readonly deviceRevoked = false;
    constructor();
}
export declare class RecoveryPending extends SignInError {
    readonly deadline: number;
    constructor(deadline: number);
}
export declare function refreshOwnedCredential(options: {
    readonly origin: string;
    readonly current: OwnedCredential;
    readonly clock?: RecoveryClock;
    readonly write: (credential: OwnedCredential) => Promise<void>;
    readonly rotate: (credential: OwnedCredential, attempt: RefreshAttempt) => Promise<OwnedCredential>;
}): Promise<OwnedCredential>;
