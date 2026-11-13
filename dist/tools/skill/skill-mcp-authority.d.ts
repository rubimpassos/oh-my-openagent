import type { LoadedSkill } from "../../features/opencode-skill-loader";
import type { SkillMcpClientInfo } from "../../features/skill-mcp-manager";
export declare function skillMcpClientInfo(skill: LoadedSkill, serverName: string, sessionID: string, directory?: string): SkillMcpClientInfo;
