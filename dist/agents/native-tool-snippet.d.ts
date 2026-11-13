/**
 * Native lists each tool in the prompt by a one-line, author-written `promptSnippet`. OpenCode tools only have a
 * full description (the model already receives it in the tools array), so this derives the equivalent line: the
 * first paragraph, sentence by sentence until it says enough, on one line, capped at a word boundary.
 */
export declare function toolPromptSnippet(description: string): string;
