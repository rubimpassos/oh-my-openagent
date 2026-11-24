import { describe, expect, test } from "bun:test"
import { buildDynamicSystemPrompt, resolvePreset } from "@code-yeongyu/senpi/prompt-presets"
import {
  adaptNativePrompt,
  buildNativeAgentPrompt,
  nativePromptOptions,
  reconcileNativeModelPrompts,
  resolveNativePromptModel,
} from "./native-model-prompt"
import { createSisyphusAgent } from "./sisyphus"
import { frameNativePrompt } from "./native-prompt-frame"

describe("OpenCode host transform", () => {
  test("translates only Native tool identifiers", () => {
    const input = "ask_user_question `todo` todo todos todo_context MY_BODY"
    expect(adaptNativePrompt(input)).toBe("question `todowrite` todo todos todo_context MY_BODY")
    expect(nativePromptOptions(["question", "todowrite", "read"]).selectedTools).toEqual([
      "ask_user_question",
      "todo",
      "read",
    ])
  })

  test("preserves uncatalogued provider namespaces after the first slash", () => {
    expect(resolveNativePromptModel("synthetic/vendor/model-id")).toEqual({
      provider: "synthetic",
      id: "vendor/model-id",
    })
  })

  test("maps tracking identifiers to the enabled task surface", () => {
    expect(adaptNativePrompt("`todo` todo_context", true)).toBe(
      "`task_create` / `task_update` / `task_list` / `task_get` todo_context",
    )
  })

  test("removes the Native-only question wait parameter", () => {
    const options = nativePromptOptions(["question"])
    const native = resolvePreset({ provider: "anthropic", id: "claude-opus-5-5" }, { promptPreset: "auto" }, options)
    expect(native).toBeDefined()
    expect(adaptNativePrompt(native?.prompt ?? "")).not.toContain("waitForAnswer")
  })

  test.each([undefined, "terminal", "chat"] as const)("uses the actual Native default with surface %s", (surface) => {
    // given
    const options = { ...nativePromptOptions(), surface: surface ?? "terminal" }
    const core = buildDynamicSystemPrompt(options)
    const identity = 'Model: {"provider":"synthetic","id":"vendor/model-id","preset":null}'
    // when
    const prompt = buildNativeAgentPrompt(
      "synthetic/vendor/model-id", "ROLE_SENTINEL", [], undefined, false, undefined, undefined, surface,
    )
    // then
    expect(nativePromptOptions([], {}, surface).surface).toBe(surface ?? "terminal")
    expect(prompt).toBe(
      frameNativePrompt([adaptNativePrompt(core), identity].join("\n\n"), {
        model: "synthetic/vendor/model-id",
        tools: [],
        ...(surface ? { surface } : {}),
      }) + "\n\nROLE_SENTINEL",
    )
  })

  test.each([
    ["anthropic/claude-opus-5-5", "claude-opus-5-5"],
    ["anthropic/claude-fable-5-1", "claude-fable-5-1"],
  ])("renders the complete identifier for %s", (model, preset) => {
    const prompt = createSisyphusAgent(model).prompt ?? ""
    const line = prompt.split("\n").find((entry) => entry.startsWith("Model: "))
    expect(line).toBeDefined()
    expect(JSON.parse((line ?? "").slice("Model: ".length))).toEqual({
      provider: "anthropic",
      id: model.slice("anthropic/".length),
      preset,
    })
  })

  test.each([undefined, "terminal", "chat"] as const)("keeps the Native preset independent from roles with surface %s", (surface) => {
    // given
    const model = { provider: "anthropic", id: "claude-opus-5-5" }
    const options = { ...nativePromptOptions(), surface: surface ?? "terminal" }
    const native = resolvePreset(model, { promptPreset: "auto" }, options)
    expect(native).toBeDefined()
    const identity = 'Model: {"provider":"anthropic","id":"claude-opus-5-5","preset":"claude-opus-5-5"}'
    const framed = frameNativePrompt([adaptNativePrompt(native?.prompt ?? ""), identity].join("\n\n"), {
      model: "anthropic/claude-opus-5-5",
      tools: [],
      ...(surface ? { surface } : {}),
    })
    // when
    const prompts = ["ROLE_A", "ROLE_B"].map((role) =>
      buildNativeAgentPrompt("anthropic/claude-opus-5-5", role, [], undefined, false, undefined, undefined, surface),
    )
    // then
    expect(prompts).toEqual([framed + "\n\nROLE_A", framed + "\n\nROLE_B"])
  })

  test.each([
    undefined,
    "anthropic/claude-opus-5-5",
    "synthetic/vendor/runtime",
  ])("reconciles only the surface while preserving runtime model %s, permissions and appends", (runtimeModel) => {
    // given
    const configuredModel = "anthropic/claude-opus-5-5"
    const toolSnippets = { read: "READ_TOOL", edit: "EDIT_TOOL", bash: "BASH_TOOL", question: "QUESTION_TOOL" }
    const rules = [{ pattern: "edit", permission: "deny" as const }]
    const runtimeRules = [{ pattern: "bash", permission: "deny" as const }]
    const initial = [buildNativeAgentPrompt(configuredModel, "ROLE", Object.keys(toolSnippets), undefined, true, toolSnippets, rules)]
    reconcileNativeModelPrompts(initial, runtimeModel, toolSnippets, undefined, runtimeRules)
    const system = [`PREFIX\n${initial[0]}\nCUSTOM_APPEND`, "OTHER_SYSTEM"]
    const model = runtimeModel ?? configuredModel
    const identity = resolveNativePromptModel(model)
    const selectedSnippets = { read: toolSnippets.read, question: toolSnippets.question }
    const options = {
      ...nativePromptOptions(),
      surface: "chat" as const,
      selectedTools: ["read", "ask_user_question"],
      toolSnippets: { read: toolSnippets.read, ask_user_question: toolSnippets.question },
    }
    const preset = resolvePreset(identity, { promptPreset: "auto" }, options)
    const core = preset?.prompt ?? buildDynamicSystemPrompt(options)
    const expected = frameNativePrompt([
      adaptNativePrompt(core, true),
      "Model: " + JSON.stringify({ provider: identity.provider, id: identity.id, preset: preset?.name ?? null }),
    ].join("\n\n"), {
      model, tools: ["read", "question"], toolSnippets: selectedSnippets, toolPermissions: rules,
      useTaskSystem: true, surface: "chat",
    })
    // when
    reconcileNativeModelPrompts(system, runtimeModel, undefined, undefined, undefined, "chat")
    // then
    expect(system).toEqual([`PREFIX\n${expected}\n\nROLE\nCUSTOM_APPEND`, "OTHER_SYSTEM"])
  })

  test.each([
    { model: "synthetic/runtime", snippets: undefined },
    { model: undefined, snippets: { read: "READ_TOOL" } },
  ])("preserves an explicit chat surface when an old caller refreshes %j", ({ model, snippets }) => {
    // given
    const system = [buildNativeAgentPrompt(
      "anthropic/claude-opus-5-5", "ROLE", [], undefined, false, undefined, undefined, "chat",
    )]
    // when
    reconcileNativeModelPrompts(system, model, snippets)
    // then
    expect(system).toEqual([buildNativeAgentPrompt(
      model ?? "anthropic/claude-opus-5-5", "ROLE", Object.keys(snippets ?? {}),
      undefined, false, snippets, undefined, "chat",
    )])
  })

  test("preserves the Hephaestus restriction when switching surfaces", () => {
    // given
    const input = buildNativeAgentPrompt("openai/gpt-5.4", "ROLE", [], "hephaestus")
    const system = [input]
    // when
    reconcileNativeModelPrompts(system, "anthropic/claude-opus-5-5", undefined, undefined, undefined, "chat")
    // then
    expect(system).toEqual([input])
  })
})
