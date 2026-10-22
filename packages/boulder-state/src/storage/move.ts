import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path"

import { BOULDER_DIR, NOTEPAD_BASE_PATH } from "../constants"
import type { BoulderState, BoulderWorkState } from "../types"
import { resolveBoulderPlanPathForWork } from "./path"
import { getBoulderWorks, readBoulderState } from "./read-state"
import { normalizeSessionId, parseIsoToMs, projectWorkToMirror } from "./shared"
import { clearBoulderState, writeBoulderState } from "./write-state"

function relativeInside(directory: string, path: string): string | null {
  const rel = relative(resolve(directory), resolve(path))
  return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel) ? rel : null
}

// Same self-ignoring `.omo/` writeBoulderState creates; copies may land there first.
function ensureStateDirectory(directory: string): void {
  const dir = join(directory, BOULDER_DIR)
  if (existsSync(dir)) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, ".gitignore"), ["*", "!/rules/", "!/rules/**", ""].join("\n"), "utf-8")
}

function isPlainName(name: string): boolean {
  return name.length > 0 && name !== "." && name !== ".." && basename(name) === name
}

function updatedMs(work: BoulderWorkState): number {
  return parseIsoToMs(work.updated_at ?? work.started_at) ?? 0
}

function newestFirst(left: BoulderWorkState, right: BoulderWorkState): number {
  return updatedMs(right) - updatedMs(left)
}

// The state holding `works`, mirroring the active one (or the newest when it is gone).
function stateFor(works: BoulderWorkState[], activeWorkId: string | undefined, base?: BoulderState): BoulderState | null {
  const mirror = works.find((work) => work.work_id === activeWorkId) ?? [...works].sort(newestFirst)[0]
  if (!mirror) return null
  const state: BoulderState = {
    ...base,
    schema_version: 2,
    works: Object.fromEntries(works.map((work) => [work.work_id, work])),
    active_work_id: mirror.work_id,
    active_plan: mirror.active_plan,
    started_at: mirror.started_at,
    session_ids: [...mirror.session_ids],
    plan_name: mirror.plan_name,
  }
  projectWorkToMirror(state, mirror)
  return state
}

function carryWork(fromDirectory: string, toDirectory: string, work: BoulderWorkState, others: BoulderWorkState[]): BoulderWorkState {
  const planPath = resolveBoulderPlanPathForWork(fromDirectory, work)
  const planInState = existsSync(planPath) ? relativeInside(join(fromDirectory, BOULDER_DIR), planPath) : null
  const copiedPlan = planInState ? join(toDirectory, BOULDER_DIR, planInState) : null
  const planTaken = copiedPlan !== null
    && others.some((other) => resolve(resolveBoulderPlanPathForWork(toDirectory, other)) === resolve(copiedPlan))
  let activePlan = planPath
  if (copiedPlan && !planTaken) {
    mkdirSync(dirname(copiedPlan), { recursive: true })
    copyFileSync(planPath, copiedPlan)
    activePlan = copiedPlan
  }

  const notepad = join(fromDirectory, NOTEPAD_BASE_PATH, work.plan_name)
  if (isPlainName(work.plan_name) && existsSync(notepad)) {
    const shared = others.some((other) => other.plan_name === work.plan_name)
    cpSync(notepad, join(toDirectory, NOTEPAD_BASE_PATH, work.plan_name), { recursive: true, force: !shared })
  }

  const carried: BoulderWorkState = { ...work, active_plan: activePlan }
  const worktreePath = work.worktree_path?.trim()
  if (worktreePath) {
    const absoluteWorktreePath = resolve(fromDirectory, worktreePath)
    // The session left its worktree: the copy in the new directory is the plan now.
    if (absoluteWorktreePath === resolve(fromDirectory)) delete carried.worktree_path
    else carried.worktree_path = absoluteWorktreePath
  }
  return carried
}

/**
 * Moves the works a session drives (it is their `direct` session) from one
 * project directory's boulder to another's, when the session itself moved
 * there. A plan file and notepad kept under the old directory's `.omo/` are
 * copied to the same place under the new one, and the work points at the
 * copy; a plan elsewhere is kept where it is, and so is one another work of
 * the new directory already uses. A copy of the work the new directory holds
 * with a newer `updated_at` wins. Returns the works moved.
 */
export function moveSessionWorks(fromDirectory: string, toDirectory: string, sessionId: string): BoulderWorkState[] {
  if (resolve(fromDirectory) === resolve(toDirectory)) return []
  const source = readBoulderState(fromDirectory)
  if (!source) return []
  const member = normalizeSessionId(sessionId)
  const works = getBoulderWorks(source)
  const leaving = works.filter((work) => work.session_origins?.[member] === "direct")
  if (leaving.length === 0) return []

  const destination = readBoulderState(toDirectory)
  const kept = destination ? getBoulderWorks(destination) : []
  const keptById = new Map(kept.map((work) => [work.work_id, work]))
  const leavingIds = new Set(leaving.map((work) => work.work_id))
  const others = kept.filter((work) => !leavingIds.has(work.work_id))
  ensureStateDirectory(toDirectory)
  // A newer copy of the work already in the destination stays, with its own plan and notepad.
  const moved = leaving
    .filter((work) => updatedMs(keptById.get(work.work_id) ?? work) <= updatedMs(work))
    .map((work) => carryWork(fromDirectory, toDirectory, work, others))

  for (const work of moved) keptById.set(work.work_id, work)
  const activeWorkId = [...moved].sort(newestFirst)[0]?.work_id ?? destination?.active_work_id
  const next = stateFor([...keptById.values()], activeWorkId, destination ?? undefined)
  if (!next || !writeBoulderState(toDirectory, next)) return []

  const rest = stateFor(works.filter((work) => !leavingIds.has(work.work_id)), source.active_work_id, source)
  if (rest) writeBoulderState(fromDirectory, rest)
  else clearBoulderState(fromDirectory)
  return moved
}
