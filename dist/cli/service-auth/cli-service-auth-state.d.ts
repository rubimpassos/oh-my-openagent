import type { ServiceAuthHooks } from "./commands";
export declare function installCliServiceAuthHooks(hooks: ServiceAuthHooks): void;
/** Hooks installed by `cli-service-auth-hooks.js` from the native device-service hand-off. */
export declare function openCodeServiceAuthHooks(): ServiceAuthHooks;
