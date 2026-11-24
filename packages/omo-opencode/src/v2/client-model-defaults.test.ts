import { describe, expect, test } from "bun:test"
import { AGENT_MODEL_REQUIREMENTS, CATEGORY_MODEL_REQUIREMENTS } from "@oh-my-opencode/model-core"

import { CLIENT_STATE_SCHEMA } from "./client-control"
import { buildClientModelDefaults } from "./client-model-defaults"

describe("client model defaults", () => {
  test("resolves the first available chain entry with its provider-specific variant", () => {
    // given
    const availableModels = new Set(["anthropic/claude-opus-5-5", "github-copilot/gpt-5.6-sol"])
    // when
    const document = buildClientModelDefaults(availableModels, ["anthropic", "github-copilot"])
    // then
    expect(document.schema).toBe(CLIENT_STATE_SCHEMA)
    expect(Object.keys(document.agents)).toEqual(Object.keys(AGENT_MODEL_REQUIREMENTS))
    expect(Object.keys(document.categories)).toEqual(Object.keys(CATEGORY_MODEL_REQUIREMENTS))
    expect(document.agents.oracle?.resolved).toEqual({ model: "github-copilot/gpt-5.6-sol", variant: "high" })
    expect(document.categories.writing?.resolved).toEqual({ model: "anthropic/claude-opus-5-5", variant: "low" })
    for (const [entries, requirements] of [
      [document.agents, AGENT_MODEL_REQUIREMENTS],
      [document.categories, CATEGORY_MODEL_REQUIREMENTS],
    ] as const) {
      for (const [name, requirement] of Object.entries(requirements)) {
        expect(entries[name]?.chain).toEqual(requirement.fallbackChain.map(({ providers, model, variant }) => ({
          providers, model, ...(variant !== undefined ? { variant } : {}),
        })))
      }
    }
  })

  test.each([
    { providers: null },
    { providers: [] },
    { providers: ["unrelated-provider"] },
  ])("omits resolved when no chain is available with providers %j", ({ providers }) => {
    // given
    const availableModels = new Set<string>()
    // when
    const document = buildClientModelDefaults(availableModels, providers === null ? null : [...providers])
    // then
    for (const entry of [...Object.values(document.agents), ...Object.values(document.categories)]) {
      expect(entry).not.toHaveProperty("resolved")
    }
  })
})
