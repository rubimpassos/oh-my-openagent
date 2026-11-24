export type ClientModelDefault = {
    readonly chain: readonly {
        readonly providers: readonly string[];
        readonly model: string;
        readonly variant?: string;
    }[];
    readonly resolved?: {
        readonly model: string;
        readonly variant?: string;
    };
};
/** Built-in defaults only; user config and UI selections never enter this document. */
export declare function buildClientModelDefaults(availableModels: Set<string>, connectedProviders: string[] | null): {
    schema: number;
    agents: Record<string, ClientModelDefault>;
    categories: Record<string, ClientModelDefault>;
};
