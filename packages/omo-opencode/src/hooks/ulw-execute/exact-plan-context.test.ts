import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { addBoulderWork, createBoulderState, getBoulderWorks, readBoulderState, resolveBoulderPlanPathForWork, writeBoulderState } from "../../features/boulder-state"
import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import { buildUlwExecuteContextInfo } from "./context-info-builder"
import { createUlwExecuteHook } from "./ulw-execute-hook"

describe("exact plan context", () => {
  let directory = ""
  function plan(relative: string, complete = false): string {
    const path = join(directory, relative)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `# Plan\n- [${complete ? "x" : " "}] Task\n`)
    return path
  }
  function select(request: string, worktreePath?: string): string {
    return buildUlwExecuteContextInfo({
      ctx: unsafeTestValue<Parameters<typeof buildUlwExecuteContextInfo>[0]["ctx"]>({ directory }),
      explicitPlanName: request, existingState: readBoulderState(directory),
      sessionId: "current", timestamp: "2026-10-29T00:00:00Z", activeAgent: "atlas",
      worktreePath, worktreeBlock: "",
    })
  }
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "exact-plan-")) })
  afterEach(() => { rmSync(directory, { recursive: true, force: true }) })

  test("creates anchored work when stored worktree redirects to a shadow plan", () => {
    // given
    const exact = plan(".omo/plans/auth.md")
    plan("shadow/.omo/plans/auth.md")
    writeBoulderState(directory, createBoulderState(exact, "original", "atlas", join(directory, "shadow")))
    const before = readBoulderState(directory)
    // when
    const context = select(".omo/plans/auth.md")
    // then
    const state = readBoulderState(directory)
    expect(context.match(/^\*\*Path\*\*: (.+)$/m)?.[1]).toBe(exact)
    expect(state?.active_work_id).not.toBe(before?.active_work_id)
    expect(state?.session_ids).toEqual(["opencode:current"])
    expect(state?.worktree_path).toBeUndefined()
    expect(state && resolveBoulderPlanPathForWork(directory, state)).toBe(exact)
    expect(state && getBoulderWorks(state).find((work) => work.work_id === before?.active_work_id)).toEqual(before && getBoulderWorks(before)[0])
  })

  test.each([false, true])("rejects explicit shadow worktree when existing work is %s", (existingWork) => {
    // given
    const exact = plan(".omo/plans/auth.md")
    plan("shadow/.omo/plans/auth.md")
    const worktree = join(directory, "shadow")
    if (existingWork) writeBoulderState(directory, createBoulderState(exact, "original", "atlas", worktree))
    const before = readBoulderState(directory)
    // when
    const context = select(".omo/plans/auth.md", worktree)
    // then
    expect(readBoulderState(directory)).toEqual(before)
    expect(context.match(/^\*\*Path\*\*: (.+)$/m)?.[1]).toBeUndefined()
  })

  test.each([".omo/plans/auth.md", "./.omo/plans/auth.md"])("resumes lexical stored identity %s when effective file is exact", (storedPath) => {
    // given
    const exact = plan(".omo/plans/auth.md")
    writeBoulderState(directory, createBoulderState(storedPath, "original", "atlas", "/first"))
    const before = readBoulderState(directory)
    // when
    const context = select(".omo/plans/auth.md", "/first")
    // then
    const state = readBoulderState(directory)
    expect(context.match(/^\*\*Path\*\*: (.+)$/m)?.[1]).toBe(exact)
    expect(state?.active_work_id).toBe(before?.active_work_id)
    expect(state?.session_ids).toEqual(["opencode:original", "opencode:current"])
    expect(state?.worktree_path).toBe("/first")
  })

  test.each([".omo/plans/auth.md", "./.omo/plans/auth.md", ".sisyphus/plans/auth.md"])("selects %s over newer same-name and case-only siblings", (request) => {
    // given
    const canonical = plan(".omo/plans/auth.md")
    plan(".omo/plans/Auth.md")
    const legacy = plan(".sisyphus/plans/auth.md")
    utimesSync(canonical, 1, 1)
    utimesSync(legacy, 100, 100)
    // when
    select(request)
    // then
    expect(readBoulderState(directory)?.active_plan).toBe(request.includes(".sisyphus") ? legacy : canonical)
  })

  test("resumes the exact file by work id rather than a different same-basename work", () => {
    // given
    const other = plan(".sisyphus/plans/auth.md")
    const exact = plan(".omo/plans/auth.md")
    writeBoulderState(directory, createBoulderState(other, "other", "atlas"))
    const added = addBoulderWork(directory, { planPath: exact, sessionId: "exact", agent: "atlas" })
    const workId = added?.active_work_id
    // when
    select(".omo/plans/auth.md")
    // then
    const state = readBoulderState(directory)
    expect(state?.active_work_id).toBe(workId)
    expect(state?.session_ids).toEqual(["opencode:exact", "opencode:current"])
    expect(state && getBoulderWorks(state).find((work) => work.active_plan === other)?.session_ids).toEqual(["opencode:other"])
  })

  test("creates separate work when only the other same-basename file has work", () => {
    // given
    const other = plan(".sisyphus/plans/auth.md")
    const exact = plan(".omo/plans/auth.md")
    writeBoulderState(directory, createBoulderState(other, "other", "atlas"))
    const previous = readBoulderState(directory)
    // when
    select(".omo/plans/auth.md")
    // then
    const state = readBoulderState(directory)
    expect(state?.active_plan).toBe(exact)
    expect(state?.active_work_id).not.toBe(previous?.active_work_id)
    expect(state && getBoulderWorks(state).find((work) => work.active_plan === other)).toEqual(previous && getBoulderWorks(previous)[0])
  })

  test("filters exact-file work by worktree identity", () => {
    // given
    const exact = plan(".omo/plans/auth.md")
    writeBoulderState(directory, createBoulderState(exact, "first", "atlas", "/first"))
    const added = addBoulderWork(directory, { planPath: exact, sessionId: "second", worktreePath: "/second" })
    // when
    select(".omo/plans/auth.md", "/second")
    // then
    expect(readBoulderState(directory)?.active_work_id).toBe(added?.active_work_id)
    expect(readBoulderState(directory)?.session_ids).toEqual(["opencode:second", "opencode:current"])
  })

  test.each([
    ".omo/plans/missing.md", ".omo/plans/AUTH.md", ".OMO/plans/auth.md",
    ".omo/plans/../plans/auth.md", ".omo/plans/nested/auth.md", ".omo/plans/auth.txt",
    ".omo/plans/auth.MD", "/.omo/plans/auth.md", "C:\\repo\\.omo\\plans\\auth.md",
    "C:/.omo/plans/auth.md", "\\\\server\\.omo\\plans\\auth.md", ".omo\\plans\\auth.md",
    "../.omo/plans/auth.md", ".omo/plans/./auth.md", ".omo/plans/auth.md/",
  ])("never falls back for rejected path %s", (request) => {
    // given
    const fallback = plan(".omo/plans/auth.md")
    writeBoulderState(directory, createBoulderState(fallback, "original", "atlas"))
    const before = readBoulderState(directory)
    // when
    select(request)
    // then
    expect(readBoulderState(directory)).toEqual(before)
  })

  test("rejects symlink escape without creating work", () => {
    // given
    const target = plan("outside.md")
    plan(".omo/plans/fallback.md")
    symlinkSync(target, join(directory, ".omo/plans/auth.md"))
    // when
    select(".omo/plans/auth.md")
    // then
    expect(readBoulderState(directory)).toBeNull()
  })

  test("does not change work for an exact completed file", () => {
    // given
    const active = plan(".omo/plans/active.md")
    plan(".omo/plans/auth.md", true)
    writeBoulderState(directory, createBoulderState(active, "original", "atlas"))
    const before = readBoulderState(directory)
    // when
    select(".omo/plans/auth.md")
    // then
    expect(readBoulderState(directory)).toEqual(before)
  })

  test("retains sole-incomplete fallback for basename requests", () => {
    // given
    const fallback = plan(".omo/plans/fallback.md")
    // when
    select("unknown-name")
    // then
    expect(readBoulderState(directory)?.active_plan).toBe(fallback)
  })

  test("creates work for a new worktree rather than resuming another worktree", () => {
    // given
    const exact = plan(".omo/plans/auth.md")
    writeBoulderState(directory, createBoulderState(exact, "first", "atlas", "/first"))
    const before = readBoulderState(directory)
    // when
    select(".omo/plans/auth.md", "/second")
    // then
    const state = readBoulderState(directory)
    expect(state?.active_work_id).not.toBe(before?.active_work_id)
    expect(state?.worktree_path).toBe("/second")
    expect(state && getBoulderWorks(state).find((work) => work.worktree_path === "/first")?.session_ids).toEqual(["opencode:first"])
  })

  test("rejects directory with markdown extension without sole-incomplete fallback", () => {
    // given
    plan(".omo/plans/fallback.md")
    mkdirSync(join(directory, ".omo/plans/auth.md"))
    // when
    select(".omo/plans/auth.md")
    // then
    expect(readBoulderState(directory)).toBeNull()
  })

  test.each(["chat.message", "command.execute.before"] as const)("persists quoted exact filename through %s", async (route) => {
    // given
    const exact = plan(".omo/plans/ulw --ship.md")
    plan(".sisyphus/plans/ulw --ship.md")
    const hook = createUlwExecuteHook(unsafeTestValue<Parameters<typeof createUlwExecuteHook>[0]>({ directory }))
    const output = { parts: [{ type: "text", text: `<command-instruction>\nYou are starting an Atlas work session.\n</command-instruction>\n<session-context></session-context>\n<user-request>".omo/plans/ulw --ship.md"</user-request>` }] }
    // when
    if (route === "chat.message") await hook[route]({ sessionID: "current" }, output)
    else await hook[route]({ sessionID: "current", command: "ulw-execute", arguments: '".omo/plans/ulw --ship.md"' }, output)
    // then
    expect(readBoulderState(directory)?.active_plan).toBe(exact)
  })
})
