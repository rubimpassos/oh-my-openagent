import { z } from "zod";
declare const markerSchema: z.ZodObject<{
    device: z.ZodNullable<z.ZodString>;
    at: z.ZodString;
}, z.core.$strip>;
export type SignedOutMarker = z.infer<typeof markerSchema>;
export declare const signedOutMarkerPath: (home: string, credential: string) => string;
export declare function readSignedOutMarker(path: string): Promise<SignedOutMarker | null>;
export declare function writeSignedOutMarker(path: string, device: string | null): Promise<void>;
export declare const clearSignedOutMarker: (path: string) => Promise<void>;
export {};
