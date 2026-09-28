/**
 * Detects whether this OpenCode process is being run and managed by
 * OpenChamber (as opposed to a bare `opencode` CLI/TUI session on the
 * user's own machine).
 *
 * OpenChamber injects `OPENCHAMBER_AGENT_TOOL_URL` into every OpenCode
 * process it spawns so the agent can reach its `openchamber_web` browser
 * control surface (see `packages/web/server/lib/agent-tool/runtime.js` in
 * the OpenChamber repo). Its presence, as a non-empty string, is therefore
 * the one supported signal that a browser-capable agent should route
 * through `openchamber_web` instead of playwright/omowright/OpenCode's own
 * desktop `browser.*` tools, none of which can reach a browser from a
 * headless web host.
 */
export function isRunningUnderOpenChamber(env: NodeJS.ProcessEnv = process.env): boolean {
  return typeof env.OPENCHAMBER_AGENT_TOOL_URL === "string" && env.OPENCHAMBER_AGENT_TOOL_URL.trim().length > 0
}
