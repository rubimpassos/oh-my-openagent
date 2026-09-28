import { describe, expect, test } from "bun:test"

import { hookMessagesToV1, writeHookMessagesBack } from "./message-shape"

describe("writeHookMessagesBack", () => {
  test("#given a hook prepends a message #then later tool messages keep their tool-result content", () => {
    // given
    const original = [
      { id: "msg_user", role: "user", content: [{ type: "text", text: "hi" }] },
      { id: "msg_assistant", role: "assistant", content: [{ type: "text", text: "calling" }, { type: "tool-call", id: "c1", name: "x", input: {} }] },
      { role: "tool", content: [{ type: "tool-result", id: "c1", result: "ok" }] },
    ]
    const edited = hookMessagesToV1(original, "ses")
    edited.unshift({ info: { sessionID: "ses", role: "user" }, parts: [{ type: "text", text: "injected" }] })

    // when
    const next = writeHookMessagesBack(original, edited)

    // then
    expect(next.map((message) => message.role)).toEqual(["user", "user", "assistant", "tool"])
    expect(next[0]).toEqual({ role: "user", content: [{ type: "text", text: "injected" }] })
    expect(next[3]?.content).toEqual([{ type: "tool-result", id: "c1", result: "ok" }])
  })

  test("#given a hook appends text to a tool message #then the text moves to a user message after it", () => {
    // given
    const original = [{ role: "tool", content: [{ type: "tool-result", id: "c1", result: "ok" }] }]
    const edited = hookMessagesToV1(original, "ses")
    edited[0]?.parts.push({ type: "text", text: "status" })

    // when
    const next = writeHookMessagesBack(original, edited)

    // then
    expect(next).toEqual([
      { role: "tool", content: [{ type: "tool-result", id: "c1", result: "ok" }] },
      { role: "user", content: [{ type: "text", text: "status" }] },
    ])
  })
})

describe("storedMessagesToV1", () => {
  test("#given a V2 stored message #then info.time carries its timestamps", async () => {
    // given
    const { storedMessagesToV1 } = await import("./message-shape")

    // when
    const [message] = storedMessagesToV1([{ id: "m1", type: "assistant", time: { created: 5 }, content: [] }], "ses")

    // then
    expect(message?.info.time).toEqual({ created: 5 })
  })
})
