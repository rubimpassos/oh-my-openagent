import type { BuiltinSkill } from "../types"

export const openchamberBrowserSkill: BuiltinSkill = {
	name: "browser",
	description:
		"Drives a real browser through OpenChamber's `openchamber_web` tool: open a page, read it, click/type/scroll, inspect computed styles, capture a screenshot for Manual-QA/visual-qa, resize the viewport, and hand off to the user for login/CAPTCHA/OTP/2FA. Active only when this OpenCode instance runs under OpenChamber. Use for any interactive browser task or UI verification; never playwright, omowright, or OpenCode's own `browser.*` desktop tools.",
	template: `# Browser (OpenChamber)

This OpenCode instance runs on the OpenChamber server. The only browser tool available is \`openchamber_web\`: headless Chrome on the server, private network blocked, dev servers started inside this project reachable on loopback.

## Never do this under OpenChamber

- Never load the \`playwright\` skill, Playwright MCP, or omowright.
- Never call OpenCode's own \`browser.*\` desktop tools - they fail with \`browser.disconnected\` on a web host.
- Never ask for a password, one-time code, or 2FA token in chat.
- Never read cookies, local/session storage, or any credential; never import cookies from anywhere.

## Actions

| Action | Use |
|---|---|
| \`browser.open({ url })\` | Opens a tab. Returns \`tabId\` - pass it to every following call. |
| \`browser.snapshot({ tabId })\` | Text content, clickable selectors, open tabs, and console errors/warnings. Read this before acting and after every navigation. |
| \`browser.click\` / \`browser.type\` / \`browser.scroll\` | Act on a selector from a prior \`browser.snapshot\`. \`browser.type\` accepts \`submit\` to press Enter afterward. |
| \`browser.back\` / \`browser.forward\` | History navigation. |
| \`browser.inspect({ selector })\` | Computed styles for one element. |
| \`browser.capture({ label })\` | Saves a PNG into the project and returns its path. This is the Manual-QA / visual-qa artifact. |
| \`browser.resize({ viewport })\` | \`mobile\` / \`tablet\` / \`desktop\` / \`fill\`. Resize before capturing a responsive screenshot. |

## Logins, CAPTCHA, OTP, 2FA - \`browser.requestHelp\`

The browser runs on the server, not on the user's machine, so a page that needs a human - a login form, a CAPTCHA, a one-time code, a 2FA prompt - cannot be solved by the agent. Call:

\`\`\`
browser.requestHelp({ reason, timeoutSeconds, tabId })
\`\`\`

- \`reason\`: what you need done, in plain language.
- \`timeoutSeconds\`: 30-900.
- \`tabId\`: the tab that needs the human, if one is already open.

This notifies the user (push, including their phone). They open the shared Server Browser surface on that tab, take over, solve it, and hand back. The call resolves to one of:

- \`outcome: "handed-back"\` - read the page again with \`browser.snapshot\` and continue.
- \`outcome: "timeout"\` - say so and stop. Never loop or retry the same request.

Most logged-in sites never need \`requestHelp\` at all: the server keeps a browser profile bound to this project, and the user signs in once from the Server Browser page. If a site still looks logged out, tell the user to sign in there - do not try to work around it yourself.

If a call fails with an error saying the user controls the browser, wait and retry later. Do not hammer it.
`,
}
