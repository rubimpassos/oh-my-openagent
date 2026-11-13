import * as Plugin from "@opencode/plugin/tui/plugin";
type NoticeToast = {
    readonly ui: {
        readonly toast: {
            readonly show: (options: {
                readonly title: string;
                readonly message: string;
                readonly variant: "warning";
                readonly duration: number;
            }) => void;
        };
    };
};
export declare function showOpenCodeV2Notice(context: NoticeToast): void;
export declare const opencodeV2Tui: Plugin.Definition;
export {};
