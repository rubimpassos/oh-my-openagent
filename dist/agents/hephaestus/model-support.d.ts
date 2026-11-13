export declare class UnsupportedHephaestusModelError extends Error {
    readonly model: string | undefined;
    constructor(model: string | undefined);
}
export declare function isHephaestusSupportedModel(model: string | undefined): boolean;
export declare function assertHephaestusSupportedModel(model: string | undefined): void;
