export type V1Handler = (input: unknown, output?: unknown) => Promise<void> | void;
export declare function safeCall(name: string, action: () => Promise<void> | void): Promise<void>;
