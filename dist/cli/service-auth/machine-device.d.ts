import { SignInError } from "./protocol";
import { type DeviceServiceHandoff, type Session } from "./session";
/** Sign-in refused because this machine already has, or may have, its one account device (#6503). */
export declare class MachineAlreadySignedIn extends SignInError {
}
/** Sign-in refused because the credential store could not be read, so this machine's device cannot be ruled out. */
export declare class MachineCredentialUnreadable extends SignInError {
}
/**
 * Attach before mint (#6503 final contract section 5): the machine's one device service holds its account device, and
 * the desktop app and the CLI use it instead of registering devices of their own. Runs before `omo login` asks for a
 * code or generates keys. Only confirmed absence starts a registration: a usable stored sign-in, an uncertain refresh,
 * a locked or unreadable store (it throws through), a device the service holds (parked included) or a service that
 * cannot be read all refuse, keeping every held identity untouched. A stored sign-in the service ended and the store
 * cleared no longer counts.
 */
export declare function refuseSecondMachineDevice(session: Pick<Session, "accessSnapshot">, deviceService: DeviceServiceHandoff | undefined, options?: {
    readonly newDevice?: boolean;
}): Promise<void>;
