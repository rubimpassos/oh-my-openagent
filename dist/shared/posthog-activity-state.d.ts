type PostHogActivityCaptureState = {
    dayUTC: string;
    captureDaily: boolean;
};
export declare function getPostHogActivityStateDir(): string;
export declare function getPostHogActivityCaptureState(now?: Date): PostHogActivityCaptureState;
export {};
