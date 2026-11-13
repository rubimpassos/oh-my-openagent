export declare function loadBunFfi(): Promise<{
    FFIType: typeof import("bun:ffi").FFIType;
    FFIFunctionCallableSymbol: typeof import("bun:ffi").FFIFunctionCallableSymbol;
    dlopen<Fns extends Record<string, import("bun:ffi").FFIFunction>>(name: string | import("bun").BunFile | URL, symbols: Fns): import("bun:ffi").Library<Fns>;
    cc<Fns extends Record<string, import("bun:ffi").FFIFunction>>(options: {
        source: string | import("bun").BunFile | URL;
        library?: string[] | string;
        include?: string[] | string;
        symbols: Fns;
        define?: Record<string, string>;
        flags?: string | string[];
    }): import("bun:ffi").Library<Fns>;
    CFunction(fn: import("bun:ffi").FFIFunction & {
        ptr: import("bun:ffi").Pointer | number | bigint;
    }): CallableFunction & {
        close(): void;
    };
    linkSymbols<Fns extends Record<string, import("bun:ffi").FFIFunction>>(symbols: Fns): import("bun:ffi").Library<Fns>;
    toBuffer(ptr: import("bun:ffi").Pointer | number | bigint, byteOffset?: number, byteLength?: number): Buffer;
    toArrayBuffer(ptr: import("bun:ffi").Pointer | number | bigint, byteOffset?: number, byteLength?: number): ArrayBuffer;
    read: typeof import("bun:ffi").read;
    ptr(view: NodeJS.TypedArray | ArrayBufferLike | DataView, byteOffset?: number): import("bun:ffi").Pointer;
    CString: import("bun:ffi").CStringConstructor;
    JSCallback: typeof import("bun:ffi").JSCallback;
    viewSource(symbols: import("bun:ffi").Symbols, is_callback?: false): string[];
    viewSource(callback: import("bun:ffi").FFIFunction, is_callback: true): string;
    suffix: string;
    default: typeof import("bun:ffi");
}>;
