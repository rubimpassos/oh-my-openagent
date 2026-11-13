import type { GitMasterConfig } from "../../config/schema";
import { resolveMultipleSkills as resolveMultipleWithOptions, resolveMultipleSkillsAsync as resolveMultipleAsyncWithOptions, type SkillResolutionOptions } from "@oh-my-opencode/skills-loader-core/opencode-skill-loader/skill-content";
import type { ShellType } from "../../shared/shell-env";
export declare function injectGitMasterConfig(template: string, config?: GitMasterConfig, shellType?: ShellType): string;
export declare function resolveSkillContent(skillName: string, options?: SkillResolutionOptions): string | null;
export declare function resolveMultipleSkills(skillNames: string[], options?: SkillResolutionOptions): ReturnType<typeof resolveMultipleWithOptions>;
export declare function resolveSkillContentAsync(skillName: string, options?: SkillResolutionOptions): Promise<string | null>;
export declare function resolveMultipleSkillsAsync(skillNames: string[], options?: SkillResolutionOptions): ReturnType<typeof resolveMultipleAsyncWithOptions>;
