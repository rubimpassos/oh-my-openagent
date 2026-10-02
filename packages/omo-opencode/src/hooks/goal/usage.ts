// What a session spent on its goal, read from its messages. Same accounting as
// OpenChamber's goal loop: the newest completed assistant turn's
// input + cache.read + output already carries the whole run (earlier turns
// fold into its cache), so the goal's tokens are that snapshot minus the
// snapshot of the last turn before the goal started. Absolute, so recording
// it twice changes nothing.

type MessageLike = { info?: Record<string, unknown> }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0)

type Turn = { created: number; completed: number; snapshot: number }

function completedTurns(messages: readonly unknown[]): Turn[] {
  const turns: Turn[] = []
  for (const message of messages) {
    const info = isRecord(message) ? (message as MessageLike).info : undefined
    if (!isRecord(info) || info.role !== "assistant") continue
    const time = isRecord(info.time) ? info.time : {}
    const created = count(time.created)
    const completed = count(time.completed)
    if (!created || !completed) continue
    const tokens = isRecord(info.tokens) ? info.tokens : {}
    const cache = isRecord(tokens.cache) ? tokens.cache : {}
    turns.push({ created, completed, snapshot: count(tokens.input) + count(cache.read) + count(tokens.output) })
  }
  return turns.sort((left, right) => left.created - right.created)
}

/** `goalStartedAt` is in seconds, like the goal record; message times are milliseconds. */
export function goalUsageFromMessages(messages: readonly unknown[], goalStartedAt: number): { tokensUsed: number; timeUsedSeconds: number } {
  const start = goalStartedAt * 1000
  const turns = completedTurns(messages)
  const before = turns.filter((turn) => turn.created < start)
  const during = turns.filter((turn) => turn.created >= start)
  const baseline = before.at(-1)?.snapshot ?? 0
  const latest = during.at(-1)?.snapshot ?? baseline
  const seconds = during.reduce((total, turn) => total + Math.max(0, turn.completed - turn.created), 0) / 1000
  return { tokensUsed: Math.max(0, Math.round(latest - baseline)), timeUsedSeconds: Math.round(seconds) }
}
