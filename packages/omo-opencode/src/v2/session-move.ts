import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { moveSessionWorks } from "@oh-my-opencode/boulder-state"

import { CONTINUATION_MARKER_DIR } from "../features/run-continuation-state"
import { createGoalController } from "../hooks/goal/controller"
import { goalFilePath } from "../hooks/goal/store"
import { GoalFileSchema } from "../hooks/goal/types"
import { log } from "../shared/logger"
import type { AdapterState } from "./adapter-state"

const STATE_DIRECTORY = ".omo/v2-state"

export type SessionMoveResult = {
  goal: boolean
  todos: boolean
  marker: boolean
  works: number
  parentLinks: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function goalUpdatedAt(file: string): number {
  try {
    return GoalFileSchema.parse(JSON.parse(readFileSync(file, "utf8"))).goal?.updatedAt ?? 0
  } catch {
    return 0
  }
}

// A newer goal already at the destination wins; the old copy and its TUI mirror go either way.
function moveGoal(fromDirectory: string, toDirectory: string, sessionID: string): boolean {
  const source = goalFilePath({ baseDir: join(fromDirectory, ".omo", "goal"), sessionID })
  if (!existsSync(source)) return false
  const destination = goalFilePath({ baseDir: join(toDirectory, ".omo", "goal"), sessionID })
  const keepDestination = existsSync(destination) && goalUpdatedAt(destination) > goalUpdatedAt(source)
  if (!keepDestination) {
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, readFileSync(source))
  }
  rmSync(source, { force: true })
  const oldMirror = join(fromDirectory, ".omo", "ulw-loop", sessionID)
  rmSync(join(oldMirror, "goals.json"), { force: true })
  if (existsSync(oldMirror) && readdirSync(oldMirror).length === 0) rmdirSync(oldMirror)
  createGoalController({ projectDir: toDirectory }).updateTui(sessionID)
  return !keepDestination
}

function moveMarker(fromDirectory: string, toDirectory: string, sessionID: string): boolean {
  const source = join(fromDirectory, CONTINUATION_MARKER_DIR, `${sessionID}.json`)
  if (!existsSync(source)) return false
  const destination = join(toDirectory, CONTINUATION_MARKER_DIR, `${sessionID}.json`)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, readFileSync(source))
  rmSync(source, { force: true })
  return true
}

function readParents(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {}
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
  return isRecord(parsed) ? parsed : {}
}

// Child → parent links are facts about sessions, wherever they run: the new directory
// gets the ones of the moved session and of its children, and the old one keeps them.
function copyParentLinks(fromDirectory: string, toDirectory: string, sessionID: string): number {
  const source = readParents(join(fromDirectory, STATE_DIRECTORY, "parents.json"))
  const links = Object.entries(source).filter(([child, parent]) => typeof parent === "string" && (child === sessionID || parent === sessionID))
  if (links.length === 0) return 0
  const destinationFile = join(toDirectory, STATE_DIRECTORY, "parents.json")
  const destination = readParents(destinationFile)
  mkdirSync(dirname(destinationFile), { recursive: true })
  writeFileSync(destinationFile, JSON.stringify({ ...destination, ...Object.fromEntries(links) }))
  return links.length
}

function attempt<T>(sessionID: string, step: string, action: () => T, fallback: T): T {
  try {
    return action()
  } catch (error) {
    log("[oh-my-openagent] v2 session move step failed", {
      sessionID,
      step,
      error: error instanceof Error ? error.message : String(error),
    })
    return fallback
  }
}

/**
 * OMO keeps a session's goal, todo list, continuation marker, Atlas works and
 * parent links under the project directory the session runs in. When OpenCode moves the
 * session to another directory (a worktree and its main checkout), they move
 * with it: the new directory's tools and continuations see them, the old one
 * stops acting on them, and deleting the old worktree loses nothing.
 */
export function moveSessionState(input: {
  fromDirectory: string
  toDirectory: string
  sessionID: string
  state: AdapterState
}): SessionMoveResult {
  const { fromDirectory, toDirectory, sessionID, state } = input
  return {
    goal: attempt(sessionID, "goal", () => moveGoal(fromDirectory, toDirectory, sessionID), false),
    todos: attempt(sessionID, "todos", () => state.moveTodos(sessionID, join(fromDirectory, STATE_DIRECTORY), join(toDirectory, STATE_DIRECTORY)), false),
    marker: attempt(sessionID, "marker", () => moveMarker(fromDirectory, toDirectory, sessionID), false),
    works: attempt(sessionID, "works", () => moveSessionWorks(fromDirectory, toDirectory, sessionID).length, 0),
    parentLinks: attempt(sessionID, "parents", () => copyParentLinks(fromDirectory, toDirectory, sessionID), 0),
  }
}

// Every location's plugin instance receives every `session.moved`, each from its own copy of
// this module; the first one to see a move carries it out. Instances read events in order, so
// moves are carried out in the order OpenCode made them.
const HANDLED_MOVES = Symbol.for("oh-my-openagent:v2-handled-session-moves")
const MAX_REMEMBERED_MOVES = 500

function claimMove(eventID: string): boolean {
  const remembered: unknown = Reflect.get(globalThis, HANDLED_MOVES)
  const handled = remembered instanceof Set ? remembered : new Set<unknown>()
  if (!(remembered instanceof Set)) Reflect.set(globalThis, HANDLED_MOVES, handled)
  if (handled.has(eventID)) return false
  handled.add(eventID)
  if (handled.size > MAX_REMEMBERED_MOVES) handled.delete(handled.values().next().value)
  return true
}

/** Follows a raw OpenCode 2 `session.moved` event; any other event is ignored. */
export function followSessionMove(raw: unknown, state: AdapterState): SessionMoveResult | undefined {
  if (!isRecord(raw) || raw.type !== "session.moved" || typeof raw.id !== "string") return undefined
  const data = isRecord(raw.data) ? raw.data : {}
  const fromDirectory = isRecord(raw.location) ? raw.location.directory : undefined
  const toDirectory = isRecord(data.location) ? data.location.directory : undefined
  const sessionID = data.sessionID
  if (typeof fromDirectory !== "string" || typeof toDirectory !== "string" || typeof sessionID !== "string") return undefined
  if (fromDirectory === toDirectory || !claimMove(raw.id)) return undefined
  const result = moveSessionState({ fromDirectory, toDirectory, sessionID, state })
  log("[oh-my-openagent] v2 session state followed a move", { sessionID, fromDirectory, toDirectory, ...result })
  return result
}
