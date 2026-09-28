function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const OMITTED_STORED_TYPES = new Set([
  "idle",
  "agent-switched",
  "model-switched",
  "location-switched",
])

export type V1Message = {
  info: Record<string, unknown>
  parts: Array<Record<string, unknown>>
}

function textPart(text: unknown): Array<Record<string, unknown>> {
  return [{ type: "text", text: typeof text === "string" ? text : "" }]
}

function partsFromContent(content: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(content)) return []
  return content.filter(isRecord).map((part) => ({ ...part }))
}

function contentFromParts(parts: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return parts.map((part) => ({ ...part }))
}

function storedMessage(message: Record<string, unknown>, sessionID: string): V1Message | undefined {
  const translated = storedMessageWithoutTime(message, sessionID)
  // V1 consumers order and window messages by info.time.created (parent wake
  // recovery, continuation); V2 keeps the same timestamps on the record.
  if (translated && isRecord(message.time)) translated.info.time = { ...message.time }
  return translated
}

function storedMessageWithoutTime(message: Record<string, unknown>, sessionID: string): V1Message | undefined {
  const type = message.type
  const id = message.id
  if (typeof type !== "string" || OMITTED_STORED_TYPES.has(type)) return undefined

  if (type === "assistant") {
    return {
      info: {
        id,
        sessionID,
        role: "assistant",
        agent: message.agent,
        model: message.model,
        ...(message.finish !== undefined ? { finish: message.finish } : {}),
        ...(message.error !== undefined ? { error: message.error } : {}),
      },
      parts: partsFromContent(message.content),
    }
  }

  if (type === "shell") {
    const output = isRecord(message.output) && typeof message.output.output === "string"
      ? message.output.output
      : typeof message.command === "string" ? message.command : ""
    return {
      info: { id, sessionID, role: "assistant" },
      parts: textPart(output),
    }
  }

  if (type === "compaction" && (message.status === "completed" || message.status === "running")) {
    return {
      info: { id, sessionID, role: "assistant" },
      parts: textPart(message.summary),
    }
  }

  if (type === "compaction") return undefined

  if (type === "user" || type === "synthetic" || type === "system" || type === "skill") {
    return {
      info: { id, sessionID, role: "user" },
      parts: textPart(message.text),
    }
  }

  return {
    info: { id, sessionID, role: "user" },
    parts: textPart(""),
  }
}

export function storedMessagesToV1(messages: unknown, sessionID: string): V1Message[] {
  if (!Array.isArray(messages)) return []
  const view: V1Message[] = []
  for (const message of messages) {
    if (!isRecord(message)) continue
    const translated = storedMessage(message, sessionID)
    if (translated) view.push(translated)
  }
  return view
}

export function hookMessagesToV1(messages: readonly unknown[], sessionID: string): V1Message[] {
  return messages.map((message) => {
    if (!isRecord(message)) {
      return { info: { sessionID, role: "user" }, parts: textPart("") }
    }
    if (typeof message.type === "string" && message.role === undefined) {
      return storedMessage(message, sessionID) ?? { info: { sessionID, role: "user" }, parts: textPart("") }
    }
    return {
      info: {
        id: message.id,
        sessionID,
        role: message.role,
        ...(message.agent !== undefined ? { agent: message.agent } : {}),
        ...(message.model !== undefined ? { model: message.model } : {}),
      },
      parts: Array.isArray(message.content) ? partsFromContent(message.content) : partsFromContent(message.parts),
    }
  })
}

export function writeHookMessagesBack<T>(original: readonly T[], edited: readonly V1Message[]): T[] {
  // Match edited messages back to the V2 originals by id, not by position:
  // V1 hooks insert messages (the team-mode injectors prepend one), which would
  // otherwise shift every later message and write an assistant's tool-call
  // into the following tool message. V2 tool messages carry no id, so id-less
  // originals are matched in order by role; anything unmatched is new.
  const byID = new Map<string, number>()
  original.forEach((message, index) => {
    if (isRecord(message) && typeof message.id === "string") byID.set(message.id, index)
  })
  const used = new Set<number>()
  let cursor = -1
  const findIDLess = (role: unknown): number | undefined => {
    for (let index = cursor + 1; index < original.length; index += 1) {
      const candidate = original[index]
      if (used.has(index) || !isRecord(candidate) || typeof candidate.id === "string") continue
      if (candidate.role === role) return index
    }
    return undefined
  }

  return edited.flatMap((message) => {
    const content = contentFromParts(message.parts)
    const id = typeof message.info.id === "string" ? message.info.id : undefined
    const matchedIndex = id !== undefined ? byID.get(id) : findIDLess(message.info.role)
    const current = matchedIndex !== undefined && !used.has(matchedIndex) ? original[matchedIndex] : undefined
    if (matchedIndex !== undefined && isRecord(current) && Array.isArray(current.content)) {
      used.add(matchedIndex)
      cursor = Math.max(cursor, matchedIndex)
      // Providers accept only tool-result content in a tool message; injected
      // text moves into a user message right after it.
      if (current.role === "tool") {
        const results = content.filter((part) => part.type === "tool-result")
        const extras = content.filter((part) => part.type === "text")
        current.content.splice(0, current.content.length, ...results)
        return extras.length > 0 ? [current, { role: "user", content: extras } as T] : [current]
      }
      current.content.splice(0, current.content.length, ...content)
      return [current]
    }
    const role = message.info.role === "assistant" ? "assistant" : "user"
    return [{
      ...(id !== undefined ? { id } : {}),
      role,
      content: role === "user" ? content.filter((part) => part.type === "text" || part.type === "media") : content,
    } as T]
  })
}
