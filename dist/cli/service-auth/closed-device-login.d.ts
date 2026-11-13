import { Command } from "commander";
/**
 * The one parse of a closed-accounts `login` (#12639, #12646). While accounts are closed the device-code sign-in
 * is the only terminal sign-in that runs. `commands.ts` refuses every other closed `login` argv, and the compiled
 * entry (`omo-native/compile-args.ts`) decides from the same argv whether to answer with the static refusal. Both
 * layers read it through this module, so `login -- --device` (an operand, not the option) cannot be a device login
 * to one layer and a refusal to the other.
 */
export declare function withClosedDeviceLoginOptions(command: Command): Command;
/** The device flow runs only for `--device` or `--no-browser` with nothing else left over (no operand, no unknown option). */
export declare function isClosedDeviceLogin(options: {
    readonly device?: unknown;
    readonly browser?: unknown;
}, leftover: readonly string[]): boolean;
/** Whether a whole `omo …` argv is the closed-accounts device-code login, parsed exactly as `commands.ts` parses it. */
export declare function parsesAsClosedDeviceLogin(args: readonly string[]): boolean;
