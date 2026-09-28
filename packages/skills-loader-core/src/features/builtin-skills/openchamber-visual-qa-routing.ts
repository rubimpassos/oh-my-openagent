const OMOWRIGHT_WEB_CAPTURE_STEP_PATTERN =
	/Capture the ACTUAL rendered screenshot[\s\S]*?for fixed-viewport examples and prerequisites\./

const OPENCHAMBER_WEB_CAPTURE_STEP =
	"Capture the ACTUAL rendered screenshot at the reference viewport with `openchamber_web`: " +
	"`browser.resize({ viewport })` to pin the viewport, then `browser.capture({ label })` to " +
	"save a PNG into the project and return its path. For a page that needs the user's login, " +
	"rely on the server-managed profile already signed in for this project; call " +
	"`browser.requestHelp` only if the page still looks logged out."

/**
 * Rewrites the `visual-qa` skill's web capture step (Step 2) to use
 * `openchamber_web` instead of omowright, for OpenCode instances running
 * under OpenChamber. The pixel-diff and verdict steps that follow are left
 * untouched.
 */
export function routeVisualQaWebCaptureForOpenChamber(template: string): string {
	return template.replace(OMOWRIGHT_WEB_CAPTURE_STEP_PATTERN, OPENCHAMBER_WEB_CAPTURE_STEP)
}
