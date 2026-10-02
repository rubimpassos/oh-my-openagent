import type { BuiltinSkill } from "./types"
import type { BrowserAutomationProvider } from "../../types"

import {
  createPlaywrightSkill,
  playwrightSkill,
  playwrightCliSkill,
  frontendSkill,
  gitMasterSkill,
  devBrowserSkill,
  initDeepSkill,
  debuggingSkill,
  removeAiSlopsSkill,
  reviewWorkSkill,
  securityResearchSkill,
  securityReviewSkill,
  visualQaSkill,
  teamModeSkill,
} from "./skills/index"

/** Every browser skill OMO ships: the provider variants and the shared browsing skills. */
export const OMO_BROWSER_SKILL_NAMES: ReadonlySet<string> = new Set([
  "playwright",
  "dev-browser",
  "playwright-cli",
  "browser",
  "ultimate-browsing",
])

/**
 * With the `external` provider another plugin provides browsing, so the
 * browser skills OMO ships itself (built-in or shared) are left out. Skills
 * the user installed are not OMO's and stay.
 */
export function omitsOwnBrowserSkill(
  provider: BrowserAutomationProvider | undefined,
  skill: { readonly name: string; readonly scope?: string },
): boolean {
  if (provider !== "external" || !OMO_BROWSER_SKILL_NAMES.has(skill.name)) return false
  return skill.scope === undefined || skill.scope === "builtin" || skill.scope === "shared"
}

export interface CreateBuiltinSkillsOptions {
  browserProvider?: BrowserAutomationProvider
  disabledSkills?: Set<string>
  teamModeEnabled?: boolean
  /**
   * Extra CLI arguments appended to the default `@playwright/mcp@latest`
   * invocation when `browserProvider` resolves to the `playwright` MCP variant.
   *
   * Only threaded through to `createPlaywrightSkill`; other browser providers
   * ignore this option.
   */
  playwrightMcpArgs?: readonly string[]
}

export function createBuiltinSkills(options: CreateBuiltinSkillsOptions = {}): BuiltinSkill[] {
  const {
    browserProvider = "playwright",
    disabledSkills,
    teamModeEnabled = false,
    playwrightMcpArgs,
  } = options

  const browserSkills = {
    "dev-browser": devBrowserSkill,
    "playwright-cli": playwrightCliSkill,
    playwright: playwrightMcpArgs?.length
      ? createPlaywrightSkill({ mcp_args: playwrightMcpArgs })
      : playwrightSkill,
  } satisfies Record<Exclude<BrowserAutomationProvider, "external">, BuiltinSkill>

	const skills = [
		...(browserProvider === "external" ? [] : [browserSkills[browserProvider]]),
		frontendSkill,
		gitMasterSkill,
		reviewWorkSkill,
		removeAiSlopsSkill,
		initDeepSkill,
		debuggingSkill,
		securityResearchSkill,
		securityReviewSkill,
		visualQaSkill,
	]

  if (teamModeEnabled && !disabledSkills?.has("team-mode")) {
    skills.push(teamModeSkill)
  }

  if (!disabledSkills) {
    return skills
  }

  return skills.filter((skill) => !disabledSkills.has(skill.name))
}

export interface ResolveActiveBuiltinSkillsOptions extends CreateBuiltinSkillsOptions {
  systemMcpNames: Set<string>
}

export function resolveActiveBuiltinSkills(options: ResolveActiveBuiltinSkillsOptions): BuiltinSkill[] {
  const { systemMcpNames, ...createOptions } = options

  return createBuiltinSkills(createOptions).filter((skill) => {
    if (!skill.mcpConfig) return true
    return !Object.keys(skill.mcpConfig).some((mcpName) => systemMcpNames.has(mcpName))
  })
}
