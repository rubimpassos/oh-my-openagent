import { describe, expect, test } from "bun:test"
import { findPlanByName } from "./plan-selection"

describe("basename plan selection", () => {
  test.each([
    ["auth", "/repo/.omo/plans/auth.md"],
    ["Auth Plan", "/repo/.omo/plans/auth-plan.md"],
    ["part", "/repo/.omo/plans/partial-feature.md"],
  ])("keeps basename matching for %s", (request, expected) => {
    // given
    const plans = ["/repo/.omo/plans/auth.md", "/repo/.omo/plans/auth-plan.md", "/repo/.omo/plans/partial-feature.md"]
    // when
    const selected = findPlanByName(plans, request)
    // then
    expect(selected).toBe(expected)
  })

  test("does not normalize path intent into a fuzzy basename match", () => {
    // given
    const plans = ["/repo/.omo/plans/omo-plans-auth-md.md"]
    // when
    const selected = findPlanByName(plans, ".omo/plans/auth.md")
    // then
    expect(selected).toBeNull()
  })
})
