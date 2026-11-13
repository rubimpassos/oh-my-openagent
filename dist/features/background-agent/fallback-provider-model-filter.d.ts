import type { ModelMetadata } from "../../shared/connected-providers-cache";
/**
 * Drops connected providers whose cached model list is known and does not contain the model.
 * Providers without a cached model list are kept, so an incomplete cache never blocks a fallback.
 */
export declare function filterProvidersServingModel(args: {
    providers: string[];
    model: string;
    connectedSet: Set<string> | null;
    modelsByProvider: Record<string, string[] | ModelMetadata[]> | undefined;
    transformModelForProvider: (providerID: string, model: string) => string;
}): string[];
