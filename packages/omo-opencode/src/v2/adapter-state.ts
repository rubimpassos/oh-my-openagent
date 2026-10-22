import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { getDataDir } from "../shared/data-path"
import { CACHE_DIR_NAME } from "../shared/plugin-identity"
import { log } from "../shared/logger"

export type TodoItem = {
  id?: string
  content: string
  status: string
  priority?: string
}

type ToastItem = {
  title?: string
  message: string
  variant?: string
}

export type AdapterState = {
  directory: string
  status: Map<string, { type: string }>
  sessions: Map<string, Record<string, unknown>>
  pendingManualContinue: Set<string>
  recordParent: (childID: string, parentID: string) => void
  parentOf: (childID: string) => string | undefined
  parents: () => Record<string, string>
  recordTodos: (sessionID: string, input: unknown) => void
  todos: (sessionID: string) => TodoItem[]
  forgetTodos: (sessionID: string) => void
  recordToast: (input: { title?: string; message?: string; variant?: string; duration?: number }) => void
  readToasts: () => ToastItem[]
  noteStatus: (sessionID: string, type: string) => void
  noteSession: (session: Record<string, unknown>) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readJson(file: string): unknown {
  if (!existsSync(file)) return undefined
  return JSON.parse(readFileSync(file, "utf8"))
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value))
}

function todoItems(input: unknown): TodoItem[] {
  const source = isRecord(input) && Array.isArray(input.todos) ? input.todos : Array.isArray(input) ? input : []
  const items: TodoItem[] = []
  for (const entry of source) {
    if (!isRecord(entry) || typeof entry.content !== "string") continue
    items.push({
      ...(typeof entry.id === "string" ? { id: entry.id } : {}),
      content: entry.content,
      status: typeof entry.status === "string" ? entry.status : "pending",
      ...(typeof entry.priority === "string" ? { priority: entry.priority } : {}),
    })
  }
  return items
}

function defaultTodoOwnersFile(): string {
  return join(getDataDir(), CACHE_DIR_NAME, "v2-todo-owners.json")
}

// Read-modify-write of a JSON object file; a file that does not parse is left alone.
function updateJsonRecord(file: string, update: (record: Record<string, unknown>) => boolean): void {
  let record: Record<string, unknown> = {}
  try {
    const parsed = readJson(file)
    if (parsed !== undefined) {
      if (!isRecord(parsed)) return
      record = parsed
    }
  } catch (error) {
    log("[oh-my-openagent] v2 state file unreadable", { file, error: error instanceof Error ? error.message : String(error) })
    return
  }
  if (update(record)) writeJson(file, record)
}

/**
 * `directory` is the location's `.omo/v2-state`. OpenCode 2 delivers every
 * session's events to every location's plugin instance, and a session can move
 * to another directory, so a todo list has one owner: the state directory that
 * last wrote it, kept in a user-level index (`todoOwnersFile`).
 */
export function createAdapterState(directory: string, options: { todoOwnersFile?: string } = {}): AdapterState {
  const parentsFile = `${directory}/parents.json`
  const todosFile = `${directory}/todos.json`
  const todoOwnersFile = options.todoOwnersFile ?? defaultTodoOwnersFile()
  const toastsFile = `${directory}/toasts.json`
  const status = new Map<string, { type: string }>()
  const sessions = new Map<string, Record<string, unknown>>()
  const pendingManualContinue = new Set<string>()

  function parents(): Record<string, string> {
    const parsed = readJson(parentsFile)
    if (!isRecord(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
  }

  function todosBySession(): Record<string, TodoItem[]> {
    const parsed = readJson(todosFile)
    if (!isRecord(parsed)) return {}
    const result: Record<string, TodoItem[]> = {}
    for (const [sessionID, value] of Object.entries(parsed)) result[sessionID] = todoItems(value)
    return result
  }

  return {
    directory,
    status,
    sessions,
    pendingManualContinue,
    recordParent(childID, parentID) {
      writeJson(parentsFile, { ...parents(), [childID]: parentID })
    },
    parentOf(childID) {
      return parents()[childID]
    },
    parents,
    recordTodos(sessionID, input) {
      writeJson(todosFile, { ...todosBySession(), [sessionID]: todoItems(input) })
      let previousOwner: unknown
      updateJsonRecord(todoOwnersFile, (owners) => {
        previousOwner = owners[sessionID]
        if (previousOwner === directory) return false
        owners[sessionID] = directory
        return true
      })
      // The session moved here: its list in the old directory is stale and must
      // neither be continued there nor shown by clients reading that project.
      if (typeof previousOwner === "string" && previousOwner !== directory) {
        updateJsonRecord(`${previousOwner}/todos.json`, (todos) => delete todos[sessionID])
      }
    },
    todos(sessionID) {
      let owner: unknown
      try {
        const owners = readJson(todoOwnersFile)
        owner = isRecord(owners) ? owners[sessionID] : undefined
      } catch (error) {
        // Without a readable index every directory keeps answering for its own file, as before the index existed.
        log("[oh-my-openagent] v2 todo owners unreadable", { error: error instanceof Error ? error.message : String(error) })
        owner = undefined
      }
      if (typeof owner === "string" && owner !== directory) return []
      return todosBySession()[sessionID] ?? []
    },
    forgetTodos(sessionID) {
      updateJsonRecord(todosFile, (todos) => delete todos[sessionID])
      updateJsonRecord(todoOwnersFile, (owners) => owners[sessionID] === directory && delete owners[sessionID])
    },
    recordToast(input) {
      if (typeof input.duration === "number" && input.duration < 200) return
      if (typeof input.message !== "string" || input.message.length === 0) return
      const current = this.readToasts()
      const last = current.at(-1)
      if (last && last.title === input.title && last.message === input.message) return
      current.push({
        ...(input.title ? { title: input.title } : {}),
        message: input.message,
        ...(input.variant ? { variant: input.variant } : {}),
      })
      writeJson(toastsFile, current)
    },
    readToasts() {
      const parsed = readJson(toastsFile)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isRecord).flatMap((entry) => {
        if (typeof entry.message !== "string") return []
        return [{
          ...(typeof entry.title === "string" ? { title: entry.title } : {}),
          message: entry.message,
          ...(typeof entry.variant === "string" ? { variant: entry.variant } : {}),
        }]
      })
    },
    noteStatus(sessionID, type) {
      status.set(sessionID, { type })
    },
    noteSession(session) {
      if (typeof session.id === "string") sessions.set(session.id, session)
    },
  }
}
