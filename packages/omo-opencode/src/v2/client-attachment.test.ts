/// <reference types="bun-types" />
import { describe, expect, spyOn, test } from "bun:test"
import { createClientAttachment, type ClientCallbackRpc } from "./client-attachment"
import { continuationRpc, type ClientAttachment } from "./client-api-contract"

type AttachmentOwner = ReturnType<typeof createClientAttachment>
function attach(owner: AttachmentOwner, clientID = "client"): ClientAttachment {
  const result = owner.attach({ instanceID: owner.instanceID, clientID, callbackRPCID: "companion.v1", presentation: { surface: "chat" } })
  switch (result.ok) {
    case true: return result.attachment
    case false: throw new Error(result.error.message)
    default: result satisfies never; throw new TypeError("Unknown attachment result")
  }
}

describe("client attachment", () => {
  test("one client owns a location and may replace its execution without accepting old controls", () => {
    // given
    const owner = createClientAttachment(() => ({ beforeGoalContinuation: async () => ({ synchronized: true }) }))
    const first = attach(owner)
    // when
    const conflict = owner.attach({ instanceID: owner.instanceID, clientID: "other", callbackRPCID: "other.v1", presentation: { surface: "terminal" } })
    const replacement = attach(owner)
    // then
    expect(conflict).toMatchObject({ ok: false, error: { code: "client_conflict" } })
    expect(owner.guard(first)()).toBe(false)
    expect(owner.guard(replacement)()).toBe(true)
    expect(owner.detach(first)).toBe(false)
    expect(owner.surface()).toBe("chat")
  })

  test("a foreign instance cannot attach or detach the current client", () => {
    // given
    const owner = createClientAttachment(() => ({ beforeGoalContinuation: async () => ({ synchronized: true }) }))
    const current = attach(owner)
    // when
    const result = owner.attach({ instanceID: "previous", clientID: "client", callbackRPCID: "companion.v1", presentation: { surface: "terminal" } })
    // then
    expect(result).toMatchObject({ ok: false, error: { code: "stale_attachment" } })
    expect(owner.detach({ ...current, instanceID: "previous" })).toBe(false)
    expect(owner.guard(current)()).toBe(true)
  })

  const scenarios = [
    { name: "unchanged", change: (_owner: AttachmentOwner, _current: ClientAttachment) => {}, valid: true, surface: "chat" },
    { name: "detached", change: (owner: AttachmentOwner, current: ClientAttachment) => { owner.detach(current) }, valid: false, surface: "terminal" },
    { name: "replaced", change: (owner: AttachmentOwner) => { attach(owner) }, valid: false, surface: "chat" },
    { name: "disposed", change: (owner: AttachmentOwner) => { owner.dispose() }, valid: false, surface: "terminal" },
  ] as const
  test.each(scenarios)("a late callback guard reflects $name attachment", async ({ change, valid, surface }) => {
    // given
    const pending = Promise.withResolvers<{ synchronized: true }>()
    const owner = createClientAttachment(() => ({ beforeGoalContinuation: () => pending.promise }))
    const current = attach(owner)
    // when
    const synchronization = owner.sync("ses_main", "goal")
    change(owner, current)
    pending.resolve({ synchronized: true })
    const guard = await synchronization
    // then
    expect(guard()).toBe(valid)
    expect(owner.surface()).toBe(surface)
  })

  test("the callback uses the registered portable protocol and a finite deadline", async () => {
    // given
    const deadlines: number[] = []
    const timeout = spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      deadlines.push(milliseconds)
      return new AbortController().signal
    })
    const payloads: unknown[] = []
    const rpc: ClientCallbackRpc = (definition) => ({
      beforeGoalContinuation: async (request, options) => {
        expect(definition.id).toBe("companion.v1")
        expect(options.signal.aborted).toBe(false)
        payloads.push(definition.methods.beforeGoalContinuation.input.parse(request))
        return definition.methods.beforeGoalContinuation.output.parse({ synchronized: true })
      },
    })
    const owner = createClientAttachment(rpc)
    const current = attach(owner)
    try {
      // when
      const guard = await owner.sync("ses_main", "goal")
      // then
      expect(payloads).toEqual([{ attachment: current, sessionID: "ses_main", expectedGoalID: "goal" }])
      expect(deadlines).toEqual([5000])
      expect(guard()).toBe(true)
    } finally {
      timeout.mockRestore()
    }
  })

  test("a returned guard becomes invalid when the attachment changes later", async () => {
    // given
    const owner = createClientAttachment(() => ({ beforeGoalContinuation: async () => ({ synchronized: true }) }))
    const current = attach(owner)
    const guard = await owner.sync("ses_main", "goal")
    // when
    owner.detach(current)
    // then
    expect(guard()).toBe(false)
  })

  test.each(["failure", "invalid_output"] as const)("callback %s blocks continuation by rejecting", async (scenario) => {
    // given
    const failure = new Error("Companion unavailable")
    const owner = createClientAttachment(() => ({
      beforeGoalContinuation: async () => {
        switch (scenario) {
          case "failure": throw failure
          case "invalid_output": return continuationRpc("companion.v1").methods.beforeGoalContinuation.output.parse({ synchronized: false })
          default: scenario satisfies never; throw new TypeError("Unknown callback scenario")
        }
      },
    }))
    attach(owner)
    // when / then
    const result = await owner.sync("ses_main", "goal").then(() => null, (error: unknown) => error)
    expect(result).toBeInstanceOf(Error)
  })
})
