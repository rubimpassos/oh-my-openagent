/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { OhMyOpenCodeConfigSchema } from "../config"
import { createSkillContext } from "./skill-context"

describe("createSkillContext under OpenChamber", () => {
  let testDirectory: string
  let originalOpenCodeConfigDir: string | undefined
  let originalClaudeConfigDir: string | undefined
  let originalOpenChamberAgentToolUrl: string | undefined

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), "omo-skill-context-openchamber-"))
    originalOpenCodeConfigDir = process.env.OPENCODE_CONFIG_DIR
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalOpenChamberAgentToolUrl = process.env.OPENCHAMBER_AGENT_TOOL_URL
    process.env.OPENCODE_CONFIG_DIR = join(testDirectory, "isolated-opencode-config")
    process.env.CLAUDE_CONFIG_DIR = join(testDirectory, "isolated-claude-config")
  })

  afterEach(() => {
    if (originalOpenCodeConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR
    } else {
      process.env.OPENCODE_CONFIG_DIR = originalOpenCodeConfigDir
    }
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
    }
    if (originalOpenChamberAgentToolUrl === undefined) {
      delete process.env.OPENCHAMBER_AGENT_TOOL_URL
    } else {
      process.env.OPENCHAMBER_AGENT_TOOL_URL = originalOpenChamberAgentToolUrl
    }
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test("#given OPENCHAMBER_AGENT_TOOL_URL is set #when the skill context is built #then exactly one browser skill is exposed and it documents openchamber_web/requestHelp", async () => {
    // given
    process.env.OPENCHAMBER_AGENT_TOOL_URL = "http://127.0.0.1:9/api/openchamber/agent-tool"
    const pluginConfig = OhMyOpenCodeConfigSchema.parse({})

    // when
    const skillContext = await createSkillContext({
      directory: testDirectory,
      pluginConfig,
    })

    // then
    const browserSkills = skillContext.mergedSkills.filter((skill) => skill.name === "browser")
    expect(browserSkills).toHaveLength(1)
    expect(browserSkills[0]?.definition.description).toContain("openchamber_web")
    const content = browserSkills[0]?.definition.template ?? ""
    expect(content).toContain("browser.requestHelp")
    expect(content).toContain("openchamber_web")
    expect(content).toContain("Never load the `playwright` skill, Playwright MCP, or omowright")
    expect(skillContext.mergedSkills.some((skill) => skill.name === "playwright")).toBe(false)

    const visualQa = skillContext.mergedSkills.find((skill) => skill.name === "visual-qa")
    const visualQaTemplate = visualQa?.definition.template ?? ""
    expect(visualQaTemplate).toContain("browser.resize({ viewport })")
    expect(visualQaTemplate).toContain("browser.capture({ label })")
    expect(visualQaTemplate).toContain("## Step 4 - Synthesize one verdict")
  })

  test("#given OPENCHAMBER_AGENT_TOOL_URL is unset #when the skill context is built #then no skill documents openchamber_web and the default provider skill is unchanged", async () => {
    // given
    delete process.env.OPENCHAMBER_AGENT_TOOL_URL
    const pluginConfig = OhMyOpenCodeConfigSchema.parse({})

    // when
    const skillContext = await createSkillContext({
      directory: testDirectory,
      pluginConfig,
    })

    // then
    expect(skillContext.mergedSkills.some((skill) => skill.name === "playwright")).toBe(true)
    const visualQa = skillContext.mergedSkills.find((skill) => skill.name === "visual-qa")
    expect(visualQa?.definition.template ?? "").not.toContain("openchamber_web")
    for (const skill of skillContext.mergedSkills) {
      expect(skill.definition.description ?? "").not.toContain("openchamber_web")
    }
  })
})
