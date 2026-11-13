export interface RecoveryClockReading {
    readonly wallTimeMs: number;
    readonly continuousTimeMs: number;
    readonly bootId: string;
}
export type RecoveryClock = () => Promise<RecoveryClockReading | null>;
export declare const readRecoveryClock: RecoveryClock;
