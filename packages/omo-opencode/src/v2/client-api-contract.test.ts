import { describe, expect, test } from "bun:test"
import { clientRpc } from "./client-api-contract"

describe("client goal RPC input boundary", () => {
  const target = { action: "update", sessionID: "ses_target", expectedGoalID: "goal_target" }

  for (const [name, update] of [
    ["accounting writes", { status: "active", tokensUsed: 0 }],
    ["calculated statuses", { status: "budgetLimited" }],
    ["an empty update", {}],
    ["an empty objective", { objective: " \n " }],
    ["a fractional budget", { tokenBudget: 1.5 }],
    ["a negative budget", { tokenBudget: -1 }],
    ["a path as session identity", { status: "paused", sessionID: "../other" }],
  ] as const) {
    test(`refuses ${name} before any controller mutation`, () => {
      // given
      const input = { ...target, ...update }
      // when
      const parsed = clientRpc.methods.controlGoal.input.safeParse(input)
      // then
      expect(parsed.success).toBe(false)
    })
  }

  test("preserves a compound update with an explicit budget removal", () => {
    // given
    const input = { ...target, status: "active", objective: "  Ship the update  ", tokenBudget: null }
    // when
    const parsed = clientRpc.methods.controlGoal.input.parse(input)
    // then
    expect(parsed).toEqual({ ...target, status: "active", objective: "Ship the update", tokenBudget: null })
  })
})
