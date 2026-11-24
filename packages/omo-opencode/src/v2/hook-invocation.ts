import { log } from "../shared/logger"

export type V1Handler = (input: unknown, output?: unknown) => Promise<void> | void

export async function safeCall(name: string, action: () => Promise<void> | void): Promise<void> {
  try {
    await action()
  } catch (error) {
    log("[oh-my-openagent] v2 hook failed", {
      hook: name,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
