const OMOWRIGHT_BROWSER_TASK_PATTERN =
	/Drive the REAL page from js eval with omowright \(staged in the `browser` skill\)[\s\S]*?launching a headless browser\./g

const OPENCHAMBER_BROWSER_TASK_GUIDANCE =
	"Drive the REAL page via `openchamber_web`: `browser.open` the URL (returns `tabId`), " +
	"`browser.snapshot` to read text/selectors/console, `browser.click` / `browser.type` / " +
	"`browser.scroll` to act, `browser.capture` to save a screenshot into the project. For a " +
	"login, CAPTCHA, or 2FA the page needs, call `browser.requestHelp({ reason, timeoutSeconds })` " +
	"(`kind: \"login\"` for an account sign-in) and wait for `handed-back` / `signed-in` or stop on " +
	"`timeout`; never ask for passwords or codes in chat, never read cookies or storage."

const OMOWRIGHT_SURFACE_MENTION_PATTERN = /browser \(omowright\)/g
const OPENCHAMBER_SURFACE_MENTION = "browser (openchamber_web)"

/**
 * Routes the ultrawork Manual-QA guidance ("Changes UI rendering" / "Renders
 * changes a page" table row, plus the shorter "browser (omowright)"
 * real-surface mentions) to `openchamber_web` for OpenCode instances running
 * under OpenChamber. A pure string transform: the caller decides when to
 * apply it (see `isRunningUnderOpenChamber` in `omo-opencode/src/shared`).
 * A no-op on prompt variants that never mention omowright (glm, planner).
 */
export function applyOpenChamberManualQaRouting(message: string): string {
	return message
		.replace(OMOWRIGHT_BROWSER_TASK_PATTERN, OPENCHAMBER_BROWSER_TASK_GUIDANCE)
		.replace(OMOWRIGHT_SURFACE_MENTION_PATTERN, OPENCHAMBER_SURFACE_MENTION)
}
