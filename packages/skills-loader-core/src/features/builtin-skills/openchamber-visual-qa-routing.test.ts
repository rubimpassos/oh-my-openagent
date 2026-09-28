import { describe, expect, it } from "bun:test"

import { routeVisualQaWebCaptureForOpenChamber } from "./openchamber-visual-qa-routing"
import { visualQaSkill } from "./skills/visual-qa"

describe("routeVisualQaWebCaptureForOpenChamber", () => {
	it("#given the shared visual-qa template #when routed for OpenChamber #then the web capture step uses openchamber_web instead of omowright", () => {
		// given
		const template = visualQaSkill.template

		// when
		const routed = routeVisualQaWebCaptureForOpenChamber(template)

		// then
		expect(routed).toContain("browser.resize({ viewport })")
		expect(routed).toContain("browser.capture({ label })")
		expect(routed).not.toContain("with omowright from js eval")
	})

	it("#given the routed template #when compared to the source #then the pixel-diff and verdict steps stay unchanged", () => {
		// given
		const template = visualQaSkill.template

		// when
		const routed = routeVisualQaWebCaptureForOpenChamber(template)

		// then
		expect(routed).toContain('node "$SKILL_DIR/scripts/visual-qa.mjs" image-diff <reference.png> <actual.png>')
		expect(routed).toContain("## Step 4 - Synthesize one verdict")
	})

	it("#given text with no omowright web capture step #when routed for OpenChamber #then it is returned unchanged", () => {
		// given
		const template = "# Some other skill\n\nNo browser capture mentioned here.\n"

		// when
		const routed = routeVisualQaWebCaptureForOpenChamber(template)

		// then
		expect(routed).toBe(template)
	})
})
