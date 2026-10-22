/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createAdapterState } from "./adapter-state"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function locations() {
  const root = mkdtempSync(join(tmpdir(), "omo-adapter-state-"))
  roots.push(root)
  const todoOwnersFile = join(root, "owners.json")
  return {
    root,
    at: (name: string) => createAdapterState(join(root, name, ".omo/v2-state"), { todoOwnersFile }),
  }
}

const open = [{ content: "Create the worktree", status: "in_progress" }, { content: "Open the PR", status: "pending" }]
const done = [{ content: "Create the worktree", status: "completed" }, { content: "Open the PR", status: "completed" }]

describe("V2 adapter todos", () => {
  test("a session that moves directories leaves no pending list behind", () => {
    // given the session wrote its list in the main checkout, then moved to a worktree
    const { at } = locations()
    const main = at("main")
    const worktree = at("worktree")
    main.recordTodos("ses_moved", { todos: open })

    // when it finishes the list in the worktree
    worktree.recordTodos("ses_moved", { todos: done })

    // then the main checkout no longer answers with its old, pending copy
    expect(main.todos("ses_moved")).toEqual([])
    expect(JSON.parse(readFileSync(join(main.directory, "todos.json"), "utf8"))).toEqual({})
    expect(worktree.todos("ses_moved").map((todo) => todo.status)).toEqual(["completed", "completed"])
  })

  test("a list left in another directory before the index existed is ignored once the session writes again", () => {
    // given a stale copy written by an older build, with no owner recorded
    const { at } = locations()
    const old = at("old")
    mkdirSync(old.directory, { recursive: true })
    writeFileSync(join(old.directory, "todos.json"), JSON.stringify({ ses_legacy: open }))
    const current = at("current")

    // when the session writes its list in its current directory
    current.recordTodos("ses_legacy", { todos: done })

    // then the old directory stops reporting its pending copy
    expect(old.todos("ses_legacy")).toEqual([])
  })

  test("deleting a session clears its list", () => {
    // given
    const { at } = locations()
    const main = at("main")
    main.recordTodos("ses_deleted", { todos: open })

    // when
    main.forgetTodos("ses_deleted")

    // then
    expect(main.todos("ses_deleted")).toEqual([])
    expect(JSON.parse(readFileSync(join(main.directory, "todos.json"), "utf8"))).toEqual({})
  })

  test("sessions in one directory keep their own lists", () => {
    // given
    const { at } = locations()
    const main = at("main")

    // when
    main.recordTodos("ses_a", { todos: open })
    main.recordTodos("ses_b", { todos: done })

    // then
    expect(main.todos("ses_a")).toHaveLength(2)
    expect(main.todos("ses_b").every((todo) => todo.status === "completed")).toBe(true)
  })
})
