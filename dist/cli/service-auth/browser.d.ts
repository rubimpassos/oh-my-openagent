type BrowserExec = (file: string, args: readonly string[], env: NodeJS.ProcessEnv) => Promise<boolean>;
export declare function openSignInBrowser(url: string, executeBrowser?: BrowserExec, platform?: NodeJS.Platform, environment?: NodeJS.ProcessEnv): Promise<boolean>;
export {};
