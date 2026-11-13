import { type ChooseDevice, type Platform, SignInError } from "./protocol";
import type { Session } from "./session";
export declare class BrowserUnavailable extends SignInError {
}
export declare function loginLoopback(session: Session, options: {
    readonly accounts: string;
    readonly name: string;
    readonly platform: Platform;
    readonly open: (url: string) => Promise<boolean>;
    readonly chooseDevice: ChooseDevice;
    /** This machine's hardware digest (#6503), sent only when the service advertises machine identity. */
    readonly machineDigest?: string;
}): Promise<void>;
