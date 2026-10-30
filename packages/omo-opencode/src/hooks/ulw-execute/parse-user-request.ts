function tokenizeRequest(argument: string): readonly { readonly value: string; readonly quoted: boolean }[] {
  const tokens: { readonly value: string; readonly quoted: boolean }[] = []
  let value = ""
  let quote: string | null = null
  let quoted = false
  for (let index = 0; index < argument.length; index++) {
    const character = argument.charAt(index)
    const next = argument.charAt(index + 1)
    if (quote !== null) {
      if (quote === '"' && character === "\\" && (next === '"' || next === "\\")) {
        value += next
        index++
      } else if (character === quote) {
        if (next && !/\s/.test(next)) return [{ value: argument, quoted: true }]
        quote = null
      } else value += character
    } else if (!value && !quoted && (character === '"' || character === "'" || character === "`")) {
      quote = character
      quoted = true
    } else if (/\s/.test(character)) {
      if (value || quoted) tokens.push({ value, quoted })
      value = ""
      quoted = false
    } else {
      value += character
    }
  }
  if (quote !== null) return [{ value: argument, quoted: true }]
  if (value || quoted) tokens.push({ value, quoted })
  return tokens
}

export interface ParsedUserRequest {
  planName: string | null
  explicitWorktreePath: string | null
  makePr: boolean
  ship: boolean
}

const EMPTY_REQUEST: ParsedUserRequest = {
  planName: null,
  explicitWorktreePath: null,
  makePr: false,
  ship: false,
}

export function parseUserRequest(promptText: string): ParsedUserRequest {
  const match = promptText.match(/<user-request>\s*([\s\S]*?)\s*<\/user-request>/i)
  if (!match) return EMPTY_REQUEST

  const tokens = tokenizeRequest(match[1].trim())
  const planTokens: string[] = []
  let explicitWorktreePath: string | null = null
  let makePr = false
  let ship = false
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (!token) continue
    if (!token.quoted && token.value === "--worktree") {
      const next = tokens[index + 1]
      if (next && (next.quoted || !next.value.startsWith("--"))) {
        explicitWorktreePath = next.value
        index++
      }
    } else if (!token.quoted && token.value === "--make-pr") {
      makePr = true
    } else if (!token.quoted && token.value === "--ship") {
      ship = true
    } else if (token.quoted || !/^(ultrawork|ulw)$/i.test(token.value)) {
      planTokens.push(token.value)
    }
  }

  return {
    planName: planTokens.join(" ") || null,
    explicitWorktreePath,
    makePr,
    ship,
  }
}
