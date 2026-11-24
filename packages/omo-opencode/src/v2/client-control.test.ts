import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"

import type { BackgroundTaskControl } from "../features/background-agent/task-registry"
import type { BackgroundTask, LaunchInput } from "../features/background-agent/types"
import {
  categoryModels,
  processClientRequests,
  providerHealth,
  runClientRequest,
} from "./client-control"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function stateDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "omo-control-"))
  directories.push(directory)
  return directory
}

function task(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: "bg_1",
    parentSessionId: "ses_parent",
    parentMessageId: "msg_1",
    description: "Run tests",
    prompt: "run the tests",
    agent: "Sisyphus-Junior",
    status: "running",
    category: "quick",
    model: { providerID: "zai", modelID: "glm-5.3" },
    ...overrides,
  }
}

function fakeControl(tasks: BackgroundTask[]) {
  const cancelled: string[] = []
  const launched: LaunchInput[] = []
  const control: BackgroundTaskControl = {
    getTask: (id) => tasks.find((item) => item.id === id),
    cancelTask: async (id) => {
      const found = tasks.find((item) => item.id === id && (item.status === "running" || item.status === "pending"))
      if (!found) return false
      cancelled.push(id)
      found.status = "cancelled"
      return true
    },
    launch: async (input) => {
      launched.push(input)
      return task({ id: "bg_2", description: input.description })
    },
  }
  return { control, cancelled, launched }
}

const request = (directory: string, body: Record<string, unknown>) => {
  mkdirSync(join(directory, "requests"), { recursive: true })
  writeFileSync(join(directory, "requests", `${String(body.id)}.json`), JSON.stringify(body))
}

describe("client requests", () => {
  test("a detached retry cannot launch after cancellation returns", async () => {
    // given
    const { control, launched } = fakeControl([task()])
    let current = true
    const pending = Promise.withResolvers<boolean>()
    control.cancelTask = () => pending.promise
    // when
    const retry = runClientRequest({ action: "retry", taskId: "bg_1" }, control, () => current)
    current = false
    pending.resolve(true)
    // then
    expect(await retry).toMatchObject({ ok: false, error: { code: "stale_attachment" } })
    expect(launched).toEqual([])
  })

  test("cancel stops the task, removes the request and records the outcome", async () => {
    const directory = stateDir()
    const { control, cancelled } = fakeControl([task()])
    request(directory, { id: "r1", action: "cancel", taskId: "bg_1" })
    expect(await processClientRequests(directory, control)).toBe(1)
    expect(cancelled).toEqual(["bg_1"])
    expect(existsSync(join(directory, "requests", "r1.json"))).toBe(false)
    expect(JSON.parse(readFileSync(join(directory, "results.json"), "utf8")).r1).toMatchObject({ ok: true, action: "cancel", taskId: "bg_1" })
  })

  test("retry relaunches the same work on the chosen model, cancelling a running attempt first", async () => {
    const directory = stateDir()
    const { control, cancelled, launched } = fakeControl([task()])
    request(directory, { id: "r2", action: "retry", taskId: "bg_1", model: "anthropic/claude-haiku-4-5" })
    await processClientRequests(directory, control)
    expect(cancelled).toEqual(["bg_1"])
    expect(launched[0]).toMatchObject({ description: "Run tests", prompt: "run the tests", agent: "Sisyphus-Junior", category: "quick", parentSessionId: "ses_parent", model: { providerID: "anthropic", modelID: "claude-haiku-4-5" } })
  })

  test("malformed requests and unknown tasks do nothing but are cleared", async () => {
    const directory = stateDir()
    const { control, launched } = fakeControl([])
    request(directory, { id: "r3", action: "delete-everything", taskId: "bg_1" })
    request(directory, { id: "r4", action: "retry", taskId: "bg_missing" })
    await processClientRequests(directory, control)
    expect(launched).toEqual([])
    const results = JSON.parse(readFileSync(join(directory, "results.json"), "utf8"))
    expect(results.r3).toBeUndefined()
    expect(results.r4).toMatchObject({ ok: false })
  })
})

describe("model health", () => {
  test("category chains read models in order, and failed attempts of the last hour group by provider", () => {
    expect(categoryModels({
      quick: { models: ["zai/glm-5.3-flash", { model: "anthropic/claude-haiku-4-5" }] },
      old: { model: "openai/gpt-6", fallback_models: ["xai/grok-4.7"] },
      off: { model: "x/y", disable: true },
    })).toEqual({ quick: ["zai/glm-5.3-flash", "anthropic/claude-haiku-4-5"], old: ["openai/gpt-6", "xai/grok-4.7"] })

    const now = Date.now()
    const failed = (id: string, provider: string, at: number, error = "no balance") => ({ attemptId: id, attemptNumber: 1, providerId: provider, modelId: "m", status: "error" as const, error, completedAt: new Date(at) })
    const health = providerHealth([
      task({ attempts: [failed("a", "zai", now - 1000), failed("b", "zai", now - 500, "quota")] }),
      task({ id: "bg_2", attempts: [failed("c", "openai", now - 2000), failed("d", "openai", now - 3 * 60 * 60 * 1000)] }),
    ], now)
    expect(health).toEqual([
      { provider: "zai", failures: 2, lastError: "quota", lastModel: "zai/m", lastAt: now - 500 },
      { provider: "openai", failures: 1, lastError: "no balance", lastModel: "openai/m", lastAt: now - 2000 },
    ])
  })
})
