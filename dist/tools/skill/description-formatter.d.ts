import type { CoreListedSkill, SkillInfo } from "./types";
import type { CommandInfo } from "../slashcommand/types";
interface CombinedDescriptionOptions {
    includeSkills?: boolean;
    coreListedSkills?: readonly CoreListedSkill[];
}
export declare function deduplicatePathAliasedSkills(skills: SkillInfo[]): SkillInfo[];
export declare function formatCombinedDescription(skills?: SkillInfo[], commands?: CommandInfo[], options?: CombinedDescriptionOptions): string;
export {};
