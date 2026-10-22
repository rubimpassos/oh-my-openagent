/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createBoulderState, getBoulderWorks, readBoulderState, writeBoulderState } from "@oh-my-opencode/boulder-state"

import { setContinuationMarkerSource } from "../features/run-continuation-state"
import { createGoalController } from "../hooks/goal/controller"
import { createAdapterState } from "./adapter-state"
import { followSessionMove } from "./session-move"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

let eventCounter = 0
function folders() {
  const root = mkdtempSync(join(tmpdir(), "omo-session-move-"))
  roots.push(root)
  const worktree = join(root, "worktree")
  const main = join(root, "main")
  mkdirSync(worktree, { recursive: true })
  mkdirSync(main, { recursive: true })
  const todoOwnersFile = join(root, "owners.json")
  const stateOf = (directory: string) => createAdapterState(join(directory, ".omo/v2-state"), { todoOwnersFile })
  const moved = (sessionID: string, from: string, to: string) => ({
    id: `evt_move_${process.pid}_${++eventCounter}`,
    type: "session.moved",
    location: { directory: from },
    data: { sessionID, location: { directory: to }, projectID: "prj" },
  })
  return { worktree, main, stateOf, moved }
}

describe("V2 session state follows a session move", () => {
  test("the goal, todo list, continuation marker, plan work and parent links move from the worktree to main", () => {
    // given a session with all of its OMO state in the worktree
    const { worktree, main, stateOf, moved } = folders()
    createGoalController({ projectDir: worktree }).setGoal("ses_moved", "Ship it")
    stateOf(worktree).recordTodos("ses_moved", { todos: [{ content: "Open the PR", status: "pending" }] })
    stateOf(worktree).recordParent("ses_child", "ses_moved")
    stateOf(worktree).recordParent("ses_unrelated", "ses_other")
    setContinuationMarkerSource(worktree, "ses_moved", "stop", "stopped", "continuation stopped")
    const planPath = join(worktree, ".omo/plans/ship.md")
    mkdirSync(join(worktree, ".omo/plans"), { recursive: true })
    writeFileSync(planPath, "# Ship\n\n- [ ] 1. Open the PR\n")
    writeBoulderState(worktree, createBoulderState(planPath, "ses_moved", "atlas"))

    // when OpenCode reports the move, as seen by an unrelated location's instance
    const result = followSessionMove(moved("ses_moved", worktree, main), stateOf(join(worktree, "..", "elsewhere")))

    // then main has all of it and the worktree none of it
    expect(result).toEqual({ goal: true, todos: true, marker: true, works: 1, parentLinks: 1 })
    expect(createGoalController({ projectDir: main }).getGoal("ses_moved")?.objective).toBe("Ship it")
    expect(createGoalController({ projectDir: worktree }).getGoal("ses_moved")).toBeNull()
    expect(JSON.parse(readFileSync(join(main, ".omo/ulw-loop/ses_moved/goals.json"), "utf8")).goals[0].title).toBe("Ship it")
    expect(existsSync(join(worktree, ".omo/ulw-loop/ses_moved"))).toBe(false)
    expect(stateOf(main).todos("ses_moved").map((todo) => todo.content)).toEqual(["Open the PR"])
    expect(stateOf(worktree).todos("ses_moved")).toEqual([])
    expect(JSON.parse(readFileSync(join(main, ".omo/run-continuation/ses_moved.json"), "utf8")).sources.stop.state).toBe("stopped")
    expect(existsSync(join(worktree, ".omo/run-continuation/ses_moved.json"))).toBe(false)
    expect(getBoulderWorks(readBoulderState(main)!)[0]!.active_plan).toBe(join(main, ".omo/plans/ship.md"))
    expect(readBoulderState(worktree)).toBeNull()
    expect(stateOf(main).parents()).toEqual({ ses_child: "ses_moved" })
    expect(stateOf(worktree).parentOf("ses_child")).toBe("ses_moved")
  })

  test("only the goal mirror leaves the old loop folder", () => {
    // given another file next to the goal's TUI mirror
    const { worktree, main, stateOf, moved } = folders()
    createGoalController({ projectDir: worktree }).setGoal("ses_loop", "Loop")
    writeFileSync(join(worktree, ".omo/ulw-loop/ses_loop/other.json"), "{}")

    // when
    followSessionMove(moved("ses_loop", worktree, main), stateOf(main))

    // then
    expect(existsSync(join(worktree, ".omo/ulw-loop/ses_loop/goals.json"))).toBe(false)
    expect(existsSync(join(worktree, ".omo/ulw-loop/ses_loop/other.json"))).toBe(true)
  })

  test("each move is carried out once, by the first instance that sees it", () => {
    // given
    const { worktree, main, stateOf, moved } = folders()
    createGoalController({ projectDir: worktree }).setGoal("ses_once", "Once")
    const event = moved("ses_once", worktree, main)

    // when every location's instance receives the same event
    const first = followSessionMove(event, stateOf(worktree))
    const second = followSessionMove(event, stateOf(main))

    // then
    expect(first?.goal).toBe(true)
    expect(second).toBeUndefined()
  })

  test("moving back and forth keeps the state with the session", () => {
    // given
    const { worktree, main, stateOf, moved } = folders()
    createGoalController({ projectDir: main }).setGoal("ses_round", "Round trip")

    // when
    followSessionMove(moved("ses_round", main, worktree), stateOf(main))
    followSessionMove(moved("ses_round", worktree, main), stateOf(worktree))

    // then
    expect(createGoalController({ projectDir: main }).getGoal("ses_round")?.objective).toBe("Round trip")
    expect(createGoalController({ projectDir: worktree }).getGoal("ses_round")).toBeNull()
  })

  test("a newer goal already in the destination is kept", () => {
    // given the destination holds a goal updated after the moving one
    const { worktree, main, stateOf, moved } = folders()
    createGoalController({ projectDir: worktree }).setGoal("ses_both", "Old")
    const goalDir = join(main, ".omo/goal")
    mkdirSync(goalDir, { recursive: true })
    const newer = createGoalController({ projectDir: main }).setGoal("ses_both", "Newer")
    writeFileSync(join(goalDir, "ses_both.json"), JSON.stringify({ version: 1, goal: { ...newer, updatedAt: newer.updatedAt + 60 } }))

    // when
    const result = followSessionMove(moved("ses_both", worktree, main), stateOf(main))

    // then
    expect(result?.goal).toBe(false)
    expect(createGoalController({ projectDir: main }).getGoal("ses_both")?.objective).toBe("Newer")
    expect(createGoalController({ projectDir: worktree }).getGoal("ses_both")).toBeNull()
  })

  test("other events and a session without OMO state are left alone", () => {
    // given
    const { worktree, main, stateOf, moved } = folders()

    // when / then
    expect(followSessionMove({ type: "session.execution.succeeded", data: { sessionID: "ses_x" } }, stateOf(main))).toBeUndefined()
    expect(followSessionMove(moved("ses_empty", worktree, main), stateOf(main))).toEqual({ goal: false, todos: false, marker: false, works: 0, parentLinks: 0 })
  })
})
