/// <reference path="../../../bun-test.d.ts" />

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"

import { appendSessionId, createBoulderState, getBoulderWorks, moveSessionWorks, readBoulderState, writeBoulderState } from "./index"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function folders() {
  const root = mkdtempSync(join(tmpdir(), "boulder-move-"))
  roots.push(root)
  const worktree = join(root, "worktree")
  const main = join(root, "main")
  mkdirSync(worktree, { recursive: true })
  mkdirSync(main, { recursive: true })
  return { root, worktree, main }
}

function writePlan(directory: string, name: string, body = "# Plan\n\n## TODOs\n\n- [x] 1. First\n- [ ] 2. Second\n"): string {
  const planPath = join(directory, ".omo/plans", `${name}.md`)
  mkdirSync(join(directory, ".omo/plans"), { recursive: true })
  writeFileSync(planPath, body)
  return planPath
}

describe("moveSessionWorks", () => {
  test("the work a session drives moves with its plan and notepad, and the old folder forgets it", () => {
    // given a work started in the worktree, with progress in its plan and a notepad entry
    const { worktree, main } = folders()
    const planPath = writePlan(worktree, "ship-it")
    mkdirSync(join(worktree, ".omo/notepads/ship-it"), { recursive: true })
    writeFileSync(join(worktree, ".omo/notepads/ship-it/learnings.md"), "- learned\n")
    writeBoulderState(worktree, createBoulderState(planPath, "ses_moved", "atlas"))

    // when the session moves to the main checkout
    const moved = moveSessionWorks(worktree, main, "ses_moved")

    // then main holds the work, pointing at its own copy of the plan, and the worktree has none
    expect(moved).toHaveLength(1)
    const work = getBoulderWorks(readBoulderState(main)!)[0]!
    expect(work.active_plan).toBe(join(main, ".omo/plans/ship-it.md"))
    expect(work.session_ids).toEqual(["opencode:ses_moved"])
    expect(readFileSync(work.active_plan, "utf8")).toContain("- [x] 1. First")
    expect(readFileSync(join(main, ".omo/notepads/ship-it/learnings.md"), "utf8")).toBe("- learned\n")
    expect(readFileSync(join(main, ".omo/.gitignore"), "utf8")).toContain("*")
    expect(readBoulderState(worktree)).toBeNull()
  })

  test("other sessions' works stay, and the old folder mirrors the one left", () => {
    // given two works in one folder, driven by two sessions
    const { worktree, main } = folders()
    writeBoulderState(worktree, createBoulderState(writePlan(worktree, "stays"), "ses_other", "atlas"))
    const state = readBoulderState(worktree)!
    const second = createBoulderState(writePlan(worktree, "leaves"), "ses_moved", "atlas")
    const leaving = Object.values(second.works!)[0]!
    writeBoulderState(worktree, { ...second, works: { ...state.works, [leaving.work_id]: leaving } })

    // when one of them moves
    moveSessionWorks(worktree, main, "ses_moved")

    // then the other work is still there, and is the folder's active plan
    const rest = readBoulderState(worktree)!
    expect(getBoulderWorks(rest).map((work) => work.plan_name)).toEqual(["stays"])
    expect(rest.plan_name).toBe("stays")
    expect(rest.session_ids).toEqual(["opencode:ses_other"])
    expect(getBoulderWorks(readBoulderState(main)!).map((work) => work.plan_name)).toEqual(["leaves"])
  })

  test("a plan outside the old folder is left where it is", () => {
    // given a work whose plan lives in a third folder
    const { root, worktree, main } = folders()
    const outside = writePlan(join(root, "elsewhere"), "outside")
    writeBoulderState(worktree, createBoulderState(outside, "ses_moved", "atlas"))

    // when
    moveSessionWorks(worktree, main, "ses_moved")

    // then main's work points at the same file, and nothing was copied
    expect(getBoulderWorks(readBoulderState(main)!)[0]!.active_plan).toBe(outside)
    expect(existsSync(join(main, ".omo/plans/outside.md"))).toBe(false)
  })

  test("a session that only joined a work as a subagent does not take the work along", () => {
    // given
    const { worktree, main } = folders()
    writeBoulderState(worktree, createBoulderState(writePlan(worktree, "parent"), "ses_parent", "atlas"))
    appendSessionId(worktree, "ses_child", "appended")

    // when the subagent session moves
    const moved = moveSessionWorks(worktree, main, "ses_child")

    // then
    expect(moved).toEqual([])
    expect(readBoulderState(main)).toBeNull()
    expect(getBoulderWorks(readBoulderState(worktree)!)).toHaveLength(1)
  })

  test("a newer copy of the same work already in the destination is kept, with its plan file", () => {
    // given the destination holds a later update of the work, with more progress in its own plan copy
    const { worktree, main } = folders()
    const state = createBoulderState(writePlan(worktree, "same", "# Plan\n\n- [ ] 1. First\n"), "ses_moved", "atlas")
    writeBoulderState(worktree, state)
    const mainPlan = writePlan(main, "same", "# Plan\n\n- [x] 1. First\n")
    const work = Object.values(state.works!)[0]!
    const later = { ...work, active_plan: mainPlan, updated_at: new Date(Date.now() + 60_000).toISOString(), status: "paused" as const }
    writeBoulderState(main, { ...state, works: { [work.work_id]: later }, active_plan: mainPlan, status: "paused", updated_at: later.updated_at })

    // when
    const moved = moveSessionWorks(worktree, main, "ses_moved")

    // then
    expect(moved).toEqual([])
    expect(getBoulderWorks(readBoulderState(main)!)[0]!.status).toBe("paused")
    expect(readFileSync(mainPlan, "utf8")).toContain("- [x] 1. First")
    expect(readBoulderState(worktree)).toBeNull()
  })

  test("a session leaving its worktree drops worktree_path, so the copied plan is the one used", () => {
    // given a work run in the worktree's own boulder, pointing at itself as its worktree
    const { worktree, main } = folders()
    writeBoulderState(worktree, createBoulderState(writePlan(worktree, "in-tree"), "ses_moved", "atlas", worktree))

    // when
    moveSessionWorks(worktree, main, "ses_moved")

    // then
    const work = getBoulderWorks(readBoulderState(main)!)[0]!
    expect(work.worktree_path).toBeUndefined()
    expect(work.active_plan).toBe(join(main, ".omo/plans/in-tree.md"))
  })

  test("a plan file another work of the destination already uses is not overwritten", () => {
    // given main runs its own work on a plan with the same file name
    const { worktree, main } = folders()
    const mainPlan = writePlan(main, "shared", "# main's plan\n\n- [ ] 1. Main task\n")
    writeBoulderState(main, createBoulderState(mainPlan, "ses_main", "atlas"))
    const worktreePlan = writePlan(worktree, "shared")
    writeBoulderState(worktree, createBoulderState(worktreePlan, "ses_moved", "atlas"))

    // when
    moveSessionWorks(worktree, main, "ses_moved")

    // then main's plan is untouched and the moved work keeps reading its own file
    expect(readFileSync(mainPlan, "utf8")).toContain("main's plan")
    const moved = getBoulderWorks(readBoulderState(main)!).find((work) => work.session_ids.includes("opencode:ses_moved"))!
    expect(moved.active_plan).toBe(worktreePlan)
    expect(getBoulderWorks(readBoulderState(main)!)).toHaveLength(2)
  })

  test("a session leaving the main checkout keeps reading its worktree's plan", () => {
    // given main's boulder runs a work in a worktree (relative worktree_path), whose copy of the plan has progress
    const { root, main } = folders()
    const mainPlan = writePlan(main, "wt-plan", "# Plan\n\n- [ ] 1. First\n")
    const worktree = join(root, "wt")
    const worktreePlan = writePlan(worktree, "wt-plan", "# Plan\n\n- [x] 1. First\n")
    writeBoulderState(main, createBoulderState(mainPlan, "ses_moved", "atlas", "../wt"))

    // when the session moves into another folder
    const elsewhere = join(root, "elsewhere")
    mkdirSync(elsewhere, { recursive: true })
    moveSessionWorks(main, elsewhere, "ses_moved")

    // then the work still reads the worktree's copy, through an absolute worktree path
    const work = getBoulderWorks(readBoulderState(elsewhere)!)[0]!
    expect(work.worktree_path).toBe(worktree)
    expect(work.active_plan).toBe(worktreePlan)
    expect(existsSync(join(elsewhere, ".omo/plans/wt-plan.md"))).toBe(false)
  })
})
