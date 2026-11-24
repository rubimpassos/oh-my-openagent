/// <reference types="bun-types" />
import { afterEach, describe, expect, jest, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { startClientStatePublisher } from "./client-state-publisher"
import { createGoalController } from "../hooks/goal/controller"

const directories: string[] = []
const stops: Array<() => void> = []
afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  jest.restoreAllMocks()
  jest.useRealTimers()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "omo-publisher-clock-"))
  directories.push(directory)
  jest.useFakeTimers()
  let now = 100_000
  jest.spyOn(Date, "now").mockImplementation(() => now)
  let reads = 0
  let changes = 0
  const stop = startClientStatePublisher({
    owner: directory,
    stateDirectory: directory,
    readTasks: () => { reads += 1; return [] },
    onStateChanged: () => { changes += 1 },
  })
  stops.push(stop)
  return { directory, stop, reads: () => reads, changes: () => changes, advance: async (ms: number) => {
    now += ms
    jest.advanceTimersByTime(ms)
    for (let i = 0; i < 10; i++) await Promise.resolve()
  } }
}

describe("client state publisher clocks", () => {
  test("invalidates client state for changed data and leaves unchanged snapshots quiet", async () => {
    // given
    const clock = setup()
    await clock.advance(0)
    await clock.advance(5_000)
    expect(clock.changes()).toBe(1)
    createGoalController({ projectDir: clock.directory }).setGoal("session", "Publish state")
    // when
    await clock.advance(5_000)
    // then
    expect(clock.changes()).toBe(2)
    expect(JSON.parse(readFileSync(join(clock.directory, "goals.json"), "utf8")).session.objective).toBe("Publish state")
  })

  test("publishes immediately but does not rescan on control-only ticks", async () => {
    // given
    const clock = setup()
    await clock.advance(0)
    // when
    await clock.advance(1_500)
    await clock.advance(1_500)
    await clock.advance(1_500)
    // then
    expect(clock.reads()).toBe(1)
    expect(existsSync(join(clock.directory, "health.json"))).toBe(true)
  })

  test("refreshes snapshots at five seconds without user activity", async () => {
    // given
    const clock = setup()
    await clock.advance(0)
    // when
    await clock.advance(5_000)
    // then
    expect(clock.reads()).toBe(2)
  })

  test("processes controls before the next snapshot and refreshes their state", async () => {
    // given
    const clock = setup()
    await clock.advance(0)
    mkdirSync(join(clock.directory, "requests"))
    writeFileSync(join(clock.directory, "requests", "cancel.json"), JSON.stringify({ id: "request1", action: "cancel", taskId: "task1" }))
    // when
    await clock.advance(1_500)
    // then
    const results = JSON.parse(readFileSync(join(clock.directory, "results.json"), "utf8"))
    expect(results.request1.action).toBe("cancel")
    expect(clock.reads()).toBe(2)
  })

  test("stops recurring publication and control processing on disposal", async () => {
    // given
    const clock = setup()
    await clock.advance(0)
    clock.stop()
    mkdirSync(join(clock.directory, "requests"))
    writeFileSync(join(clock.directory, "requests", "cancel.json"), JSON.stringify({ id: "request1", action: "cancel", taskId: "task1" }))
    // when
    await clock.advance(30_000)
    // then
    expect(clock.reads()).toBe(1)
    expect(existsSync(join(clock.directory, "results.json"))).toBe(false)
  })
})
