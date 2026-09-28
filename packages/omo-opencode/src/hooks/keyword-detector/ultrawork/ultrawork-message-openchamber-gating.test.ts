import { afterEach, describe, expect, it } from "bun:test"

import { ULTRAWORK_DEFAULT_PROMPT } from "@oh-my-opencode/prompts-core"
import { getUltraworkMessageForSource } from "./index"

const originalOpenChamberAgentToolUrl = process.env.OPENCHAMBER_AGENT_TOOL_URL

afterEach(() => {
	if (originalOpenChamberAgentToolUrl === undefined) {
		delete process.env.OPENCHAMBER_AGENT_TOOL_URL
	} else {
		process.env.OPENCHAMBER_AGENT_TOOL_URL = originalOpenChamberAgentToolUrl
	}
})

describe("getUltraworkMessageForSource under OpenChamber gating", () => {
	it("#given OPENCHAMBER_AGENT_TOOL_URL is unset #when the default ultrawork message is requested #then it is byte-identical to the bundled prompt", () => {
		// given
		delete process.env.OPENCHAMBER_AGENT_TOOL_URL

		// when
		const message = getUltraworkMessageForSource("default")

		// then
		expect(message).toBe(ULTRAWORK_DEFAULT_PROMPT)
	})

	it("#given OPENCHAMBER_AGENT_TOOL_URL is set #when the default ultrawork message is requested #then it is routed to openchamber_web", () => {
		// given
		process.env.OPENCHAMBER_AGENT_TOOL_URL = "http://127.0.0.1:9/api/openchamber/agent-tool"

		// when
		const message = getUltraworkMessageForSource("default")

		// then
		expect(message).toContain("Drive the REAL page via `openchamber_web`")
		expect(message).toContain("`browser.requestHelp({ reason, timeoutSeconds })`")
		expect(message).not.toContain("omowright")
		expect(message).not.toBe(ULTRAWORK_DEFAULT_PROMPT)
	})

	it("#given OPENCHAMBER_AGENT_TOOL_URL is only whitespace #when the default ultrawork message is requested #then it is treated as unset and left unchanged", () => {
		// given
		process.env.OPENCHAMBER_AGENT_TOOL_URL = "   "

		// when
		const message = getUltraworkMessageForSource("default")

		// then
		expect(message).toBe(ULTRAWORK_DEFAULT_PROMPT)
	})
})
