type JsonFileCacheStoreOptions<TValue> = {
    getCacheDir: () => string;
    filename: string;
    logPrefix: string;
    cacheLabel: string;
    describe: (value: TValue) => Record<string, unknown>;
    serialize?: (value: TValue) => string;
    /**
     * The part of a value that decides whether writeIfChanged rewrites the file.
     * Lets a store ignore volatile fields such as a generation timestamp.
     */
    comparable?: (value: TValue) => unknown;
};
type JsonFileCacheStore<TValue> = {
    read: () => TValue | null;
    has: () => boolean;
    write: (value: TValue) => void;
    /**
     * Write only when the content differs from what is already on disk.
     * Returns true when the file was rewritten, false when the write was
     * skipped because nothing changed.
     */
    writeIfChanged: (value: TValue) => boolean;
    resetMemory: () => void;
};
export declare function createJsonFileCacheStore<TValue>(options: JsonFileCacheStoreOptions<TValue>): JsonFileCacheStore<TValue>;
export {};
