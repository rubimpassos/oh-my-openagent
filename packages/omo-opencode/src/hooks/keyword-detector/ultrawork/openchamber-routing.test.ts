import { describe, expect, it } from "bun:test"
import {
	ULTRAWORK_DEFAULT_PROMPT,
	ULTRAWORK_GEMINI_PROMPT,
	ULTRAWORK_GLM_PROMPT,
	ULTRAWORK_GPT_PROMPT,
	ULTRAWORK_PLANNER_PROMPT,
} from "@oh-my-opencode/prompts-core"

import { applyOpenChamberManualQaRouting } from "./openchamber-routing"

describe("applyOpenChamberManualQaRouting", () => {
	it("#given the default ultrawork prompt #when routed for OpenChamber #then the UI-rendering row points to openchamber_web and requestHelp", () => {
		// given
		const message = ULTRAWORK_DEFAULT_PROMPT

		// when
		const routed = applyOpenChamberManualQaRouting(message)

		// then
		expect(routed).toContain("Drive the REAL page via `openchamber_web`")
		expect(routed).toContain("`browser.requestHelp({ reason, timeoutSeconds })`")
		expect(routed).toContain("browser (openchamber_web)")
		expect(routed).not.toContain("omowright")
	})

	it("#given the gemini ultrawork prompt #when routed for OpenChamber #then omowright guidance is replaced", () => {
		// given
		const message = ULTRAWORK_GEMINI_PROMPT

		// when
		const routed = applyOpenChamberManualQaRouting(message)

		// then
		expect(routed).toContain("Drive the REAL page via `openchamber_web`")
		expect(routed).not.toContain("omowright")
	})

	it("#given the gpt ultrawork prompt #when routed for OpenChamber #then omowright guidance is replaced", () => {
		// given
		const message = ULTRAWORK_GPT_PROMPT

		// when
		const routed = applyOpenChamberManualQaRouting(message)

		// then
		expect(routed).toContain("Drive the REAL page via `openchamber_web`")
		expect(routed).not.toContain("omowright")
	})

	it("#given a prompt variant with no omowright mentions #when routed for OpenChamber #then it is returned unchanged", () => {
		// given
		const glmMessage = ULTRAWORK_GLM_PROMPT
		const plannerMessage = ULTRAWORK_PLANNER_PROMPT

		// when
		const routedGlm = applyOpenChamberManualQaRouting(glmMessage)
		const routedPlanner = applyOpenChamberManualQaRouting(plannerMessage)

		// then
		expect(routedGlm).toBe(glmMessage)
		expect(routedPlanner).toBe(plannerMessage)
	})

	it("#given the default ultrawork prompt #when routed for OpenChamber #then the visual-qa row and everything else outside the browser row is unchanged", () => {
		// given
		const message = ULTRAWORK_DEFAULT_PROMPT

		// when
		const routed = applyOpenChamberManualQaRouting(message)

		// then
		expect(routed).toContain(
			"Load the visual-qa skill: capture reference + actual screenshots (web) or the xterm.js web terminal render (TUI",
		)
		expect(routed).toContain("<MANUAL_QA_MANDATE>")
	})
})
