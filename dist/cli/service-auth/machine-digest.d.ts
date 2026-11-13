/** `SHA256(UTF8("omo-machine-v1" + normalizedHardwareId))`, lowercase hex: the only form the hardware id leaves the machine in. */
export declare function machineDigestOf(hardwareId: string): string;
/** This machine's digest, or undefined when no validated hardware id exists (no digest is sent then, never a sentinel). */
export declare function readMachineDigest(read?: () => Promise<string | null>): Promise<string | undefined>;
/** Whether a `/v1/health` reply advertises `capabilities.machineIdentity: "hardware-digest-v1"`. */
export declare function advertisesMachineIdentity(health: unknown): boolean;
