/** The one switch for OmO service accounts (#10262): set to true when accounts open to everyone. */
export declare const SERVICE_ACCOUNTS_OPEN: boolean;
export declare function serviceAccountsOpen(): boolean;
/**
 * Where this computer signs in to OmO: `omo login` once accounts open, until then the desktop app,
 * whose sign-in the CLI shares through `omo account adopt`. Every sign-in hint keys on this, so no
 * message sends a person to a command that refuses (#11379).
 */
export type SignInRoute = "cli" | "desktop";
export declare function signInRoute(open?: boolean): SignInRoute;
export declare function signInHint(when: "first" | "again", route?: SignInRoute): string;
