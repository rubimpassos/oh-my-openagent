import type { PluginContext } from "./types";
import type { SkillDiagnostic } from "@oh-my-opencode/skills-loader-core/opencode-skill-loader";
export declare function showSkillSecurityNotice(ctx: Pick<PluginContext, "client">, message: string, category?: SkillDiagnostic["category"]): void;
