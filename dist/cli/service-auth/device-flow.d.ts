import { type ChooseDevice, type Platform } from "./protocol";
import type { Session } from "./session";
export type DisplayCode = {
    readonly verificationUri: string;
    readonly userCode: string;
    readonly matchingCode: string;
};
export declare function loginDevice(session: Session, options: {
    readonly name: string;
    readonly platform: Platform;
    readonly show: (code: DisplayCode) => void;
    readonly chooseDevice: ChooseDevice;
    /** This machine's hardware digest (#6503), sent only when the service advertises machine identity. */
    readonly machineDigest?: string;
    readonly now?: () => number;
    readonly sleep?: (ms: number) => Promise<void>;
}): Promise<void>;
