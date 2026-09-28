import type { BuiltinSkill } from "../types"

export const openchamberBrowserSkill: BuiltinSkill = {
	name: "browser",
	description:
		"Drives a real browser through OpenChamber's `openchamber_web` tool: open a page, read it, click/type/scroll, inspect computed styles, capture a screenshot for Manual-QA/visual-qa, resize the viewport, and hand off to the user for login/CAPTCHA/OTP/2FA, and save a renewed sign-in into the project's profile. Active only when this OpenCode instance runs under OpenChamber. Use for any interactive browser task or UI verification; never playwright, omowright, or OpenCode's own `browser.*` desktop tools.",
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
browser.requestHelp({ reason, timeoutSeconds, kind, tabId })
\`\`\`

- \`reason\`: what you need done, in plain language.
- \`timeoutSeconds\`: 30-900.
- \`kind\`: \`"login"\` when the site needs an account sign-in (the user signs in to the project's saved profile and you continue with it), \`"page"\` (default) for a CAPTCHA, one-time code, or confirmation on this page only.
- \`tabId\`: the tab that needs the human, if one is already open.

This notifies the user (push, including their phone). The call resolves to one of:

- \`outcome: "handed-back"\` - the user solved it on your page; read it again with \`browser.snapshot\` and continue.
- \`outcome: "signed-in"\` - the user signed in and saved the profile; your browser now runs on a fresh copy with that sign-in and your pages reopened (new tab ids in the answer). Snapshot and continue.
- \`outcome: "timeout"\` - say so and stop. Never loop or retry the same request.

## Saved profiles - \`browser.saveProfile\`

A project bound to a saved profile gives every chat its own copy of it: your cookies and storage are private to this chat and other chats may use the same profile at the same time (\`browser.snapshot\` lists them under \`profile.alsoUsedBy\`). What you change is dropped when your browser closes unless you call \`browser.saveProfile()\`. Save only when the change should outlive this chat - for example after you renewed an expired login - never for throwaway state.

- Saving restarts your browser briefly and reopens your pages with new tab ids; unsent form input is lost, so save between steps.
- If another chat saved the profile after your copy was taken, the save is refused so it does not overwrite theirs. Your browser already runs on a fresh copy with their save: redo your change and save again.
- A project without a saved profile has nothing to save; do not ask the user to create one unless they want logins to persist.

If a call fails with an error saying the user controls the browser, wait and retry later. Do not hammer it.
`,
}
