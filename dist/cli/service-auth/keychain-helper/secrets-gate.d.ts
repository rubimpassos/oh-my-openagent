/** Runs one Bun.secrets call after every earlier one has settled. */
export declare function gatedSecrets<T>(run: () => Promise<T>): Promise<T>;
/** As `gatedSecrets`, with keychain interaction off for exactly this call: it can never show a dialog. */
export declare function silentSecrets<T>(run: () => Promise<T>): Promise<T>;
