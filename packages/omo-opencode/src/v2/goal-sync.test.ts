import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"

import { createGoalController } from "../hooks/goal/controller"
import { registerGoalWake } from "../hooks/goal/sync-bridge"
import { createGoalSync, OMO_GOAL_DRIVER } from "./goal-sync"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

type Metadata = Record<string, unknown>

function setup() {
  const projectDir = mkdtempSync(join(tmpdir(), "omo-goal-sync-"))
  directories.push(projectDir)
  const records = new Map<string, Metadata>([["ses_1", { openchamber: { assist: { recap: "kept" } } }]])
  const writes: string[] = []
  const session = {
    get: async ({ sessionID }: { sessionID: string }) => ({ id: sessionID, metadata: records.get(sessionID) ?? {} }),
    update: async ({ sessionID, metadata }: { sessionID: string; metadata: Metadata }) => {
      writes.push(sessionID)
      records.set(sessionID, metadata)
    },
  }
  const controller = createGoalController({ projectDir })
  const sync = createGoalSync({ projectDir, session })
  const mirror = () => (records.get("ses_1")?.openchamber as { goal?: Metadata } | undefined)?.goal
  const editMirror = (change: Metadata) => {
    const metadata = records.get("ses_1") ?? {}
    const namespace = metadata.openchamber as Metadata
    records.set("ses_1", { ...metadata, openchamber: { ...namespace, goal: { ...(namespace.goal as Metadata), ...change, updatedAt: Date.now() + 5_000 } } })
  }
  return { controller, sync, mirror, editMirror, records, writes, projectDir }
}

describe("OMO goal ↔ OpenChamber goal", () => {
  test("an OMO goal is mirrored with its driver, keeping the rest of the metadata, and only rewritten on change", async () => {
    const { controller, sync, mirror, records, writes } = setup()
    controller.setGoal("ses_1", "make the build green")
    await sync()
    expect(mirror()).toMatchObject({ objective: "make the build green", status: "active", objectiveFile: false, driver: OMO_GOAL_DRIVER, tokenBudget: null })
    expect((records.get("ses_1")?.openchamber as Metadata).assist).toEqual({ recap: "kept" })
    await sync()
    expect(writes).toHaveLength(1)
    controller.pauseGoal("ses_1")
    await sync()
    expect(mirror()?.status).toBe("paused")
  })

  test("pause, resume, a new objective and a budget set in OpenChamber reach OMO's goal", async () => {
    const { controller, sync, editMirror } = setup()
    controller.setGoal("ses_1", "make the build green")
    await sync()
    editMirror({ status: "paused" })
    await sync()
    expect(controller.getGoal("ses_1")?.status).toBe("paused")
    editMirror({ status: "active", objective: "ship the release", tokenBudget: 50_000 })
    await sync()
    expect(controller.getGoal("ses_1")).toMatchObject({ status: "active", objective: "ship the release", tokenBudget: 50_000 })
  })

  test("a mirror write that never landed does not clear OMO's goal", async () => {
    const { controller, projectDir } = setup()
    controller.setGoal("ses_1", "keep me")
    const lossy = createGoalSync({ projectDir, session: { get: async () => ({ metadata: {} }), update: async () => {} } })
    await lossy()
    await lossy()
    expect(controller.getGoal("ses_1")?.objective).toBe("keep me")
  })

  test("clearing the goal in OpenChamber clears OMO's, and clearing it in OMO removes the mirror", async () => {
    const { controller, sync, records, mirror } = setup()
    controller.setGoal("ses_1", "first")
    await sync()
    await sync() // the mirror is read back before its absence means anything
    records.set("ses_1", { openchamber: {} })
    await sync()
    expect(controller.getGoal("ses_1")).toBeNull()

    controller.setGoal("ses_1", "second")
    await sync()
    await sync()
    expect(mirror()?.objective).toBe("second")
    controller.clearGoal("ses_1")
    await sync()
    expect(mirror()).toBeUndefined()
  })

  test("a goal that moved away with its session keeps its mirror for the new directory", async () => {
    // given a mirrored goal, then the session and its goal moved to another directory
    const { controller, sync, records, mirror, projectDir } = setup()
    controller.setGoal("ses_1", "follow the session")
    await sync()
    await sync()
    const elsewhere = join(projectDir, "..", "elsewhere")
    const moved = createGoalSync({
      projectDir,
      session: {
        get: async ({ sessionID }) => ({ id: sessionID, location: { directory: elsewhere }, metadata: records.get(sessionID) ?? {} }),
        update: async ({ sessionID, metadata }) => { records.set(sessionID, metadata) },
      },
    })
    await moved()
    await moved()
    controller.clearGoal("ses_1")

    // when the old directory syncs and no longer finds the goal
    await moved()

    // then the mirror stays for the directory the goal moved to
    expect(mirror()?.objective).toBe("follow the session")
  })

  test("a pause is kept even when OMO touched its goal after the click (newer updatedAt)", async () => {
    const { controller, sync, records } = setup()
    controller.setGoal("ses_1", "make the build green")
    await sync()
    // The user pauses: OpenChamber writes the mirror with its own clock.
    const metadata = records.get("ses_1") ?? {}
    const namespace = metadata.openchamber as Metadata
    records.set("ses_1", { ...metadata, openchamber: { ...namespace, goal: { ...(namespace.goal as Metadata), status: "paused", updatedAt: 1 } } })
    // OMO tallies usage afterwards, so its updatedAt is now the newer one.
    controller.recordUsage("ses_1", { tokensUsed: 1234, timeUsedSeconds: 9 })
    await sync()
    expect(controller.getGoal("ses_1")?.status).toBe("paused")
    expect((((records.get("ses_1")?.openchamber as Metadata).goal) as Metadata).status).toBe("paused")
  })

  test("a resume in OpenChamber wakes the goal loop; session() syncs one session on demand", async () => {
    const { controller, sync, editMirror, projectDir } = setup()
    const woken: string[] = []
    const stop = registerGoalWake(projectDir, (sessionID) => { woken.push(sessionID) })
    try {
      controller.setGoal("ses_1", "make the build green")
      await sync()
      editMirror({ status: "paused" })
      await sync.session("ses_1")
      expect(controller.getGoal("ses_1")?.status).toBe("paused")
      expect(woken).toEqual([])
      editMirror({ status: "active" })
      await sync.session("ses_1")
      expect(controller.getGoal("ses_1")?.status).toBe("active")
      expect(woken).toEqual(["ses_1"])
    } finally {
      stop()
    }
  })
})
