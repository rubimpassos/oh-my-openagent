import { describe, expect, it } from "bun:test"

import { isRunningUnderOpenChamber } from "./openchamber-runtime"

describe("isRunningUnderOpenChamber", () => {
  it("#given OPENCHAMBER_AGENT_TOOL_URL is a non-empty string #when checking the runtime #then it reports true", () => {
    // given
    const env = { OPENCHAMBER_AGENT_TOOL_URL: "http://127.0.0.1:9/api/openchamber/agent-tool" }

    // when
    const result = isRunningUnderOpenChamber(env)

    // then
    expect(result).toBe(true)
  })

  it("#given OPENCHAMBER_AGENT_TOOL_URL is absent #when checking the runtime #then it reports false", () => {
    // given
    const env = {}

    // when
    const result = isRunningUnderOpenChamber(env)

    // then
    expect(result).toBe(false)
  })

  it("#given OPENCHAMBER_AGENT_TOOL_URL is an empty string #when checking the runtime #then it reports false", () => {
    // given
    const env = { OPENCHAMBER_AGENT_TOOL_URL: "" }

    // when
    const result = isRunningUnderOpenChamber(env)

    // then
    expect(result).toBe(false)
  })

  it("#given OPENCHAMBER_AGENT_TOOL_URL is only whitespace #when checking the runtime #then it reports false", () => {
    // given
    const env = { OPENCHAMBER_AGENT_TOOL_URL: "   " }

    // when
    const result = isRunningUnderOpenChamber(env)

    // then
    expect(result).toBe(false)
  })

  it("#given no argument is passed #when checking the runtime #then it reads process.env directly", () => {
    // given
    const original = process.env.OPENCHAMBER_AGENT_TOOL_URL
    process.env.OPENCHAMBER_AGENT_TOOL_URL = "http://127.0.0.1:9/api/openchamber/agent-tool"

    try {
      // when
      const result = isRunningUnderOpenChamber()

      // then
      expect(result).toBe(true)
    } finally {
      if (original === undefined) {
        delete process.env.OPENCHAMBER_AGENT_TOOL_URL
      } else {
        process.env.OPENCHAMBER_AGENT_TOOL_URL = original
      }
    }
  })
})
