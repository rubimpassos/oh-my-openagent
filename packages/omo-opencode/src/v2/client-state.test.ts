import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"

import { TeamModeConfigSchema } from "@oh-my-opencode/team-core/config"

import {
  archiveBackgroundTask,
  clearBackgroundTaskRegistryForTesting,
  listRegisteredBackgroundTasks,
  rememberBackgroundTask,
} from "../features/background-agent/task-registry"
import type { BackgroundTask } from "../features/background-agent/types"
import { backgroundTasksByParent, startClientStatePublisher, teamRunsByLead } from "./client-state"

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function scratch(): string {
  const directory = mkdtempSync(join(tmpdir(), "omo-client-state-"))
  directories.push(directory)
  return directory
}

function task(overrides: Partial<BackgroundTask>): BackgroundTask {
  return {
    id: "bg_1",
    parentSessionId: "ses_parent",
    parentMessageId: "msg_1",
    description: "Find the auth middleware",
    prompt: "[redacted]",
    agent: "explore",
    status: "running",
    ...overrides,
  }
}

function writeRun(baseDir: string, run: Record<string, unknown>): void {
  const directory = join(baseDir, "runtime", String(run.teamRunId))
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, "state.json"), JSON.stringify(run))
}

function run(teamRunId: string, status: string, leadSessionId: string): Record<string, unknown> {
  return {
    version: 1,
    teamRunId,
    teamName: "reviewers",
    specSource: "project",
    createdAt: 1,
    status,
    leadSessionId,
    members: [
      { name: "lead", sessionId: leadSessionId, agentType: "leader", status: "running", pendingInjectedMessageIds: [] },
      { name: "alice", sessionId: "ses_alice", agentType: "general-purpose", status: "idle", pendingInjectedMessageIds: [] },
    ],
    shutdownRequests: [],
    bounds: { maxMembers: 8, maxParallelMembers: 4, maxMessagesPerRun: 10000, maxWallClockMinutes: 120, maxMemberTurns: 500 },
  }
}

describe("OpenCode V2 client state", () => {
  test("background tasks are grouped by the session that launched them, without prompts", () => {
    const byParent = backgroundTasksByParent([
      task({ id: "bg_2", startedAt: new Date(20), sessionId: "ses_child", progress: { toolCalls: 3, lastTool: "grep", lastUpdate: new Date(25) } }),
      task({ id: "bg_1", startedAt: new Date(10), status: "completed", completedAt: new Date(30) }),
      task({ id: "bg_other", parentSessionId: "ses_other", status: "error", error: "model failed" }),
    ])
    expect(byParent.ses_parent).toEqual([
      { id: "bg_1", description: "Find the auth middleware", agent: "explore", status: "completed", startedAt: 10, completedAt: 30 },
      { id: "bg_2", description: "Find the auth middleware", agent: "explore", status: "running", sessionID: "ses_child", startedAt: 20, toolCalls: 3, lastTool: "grep" },
    ])
    expect(byParent.ses_other?.[0]?.error).toBe("model failed")
    expect(JSON.stringify(byParent)).not.toContain("redacted")
  })

  test("the registry lists only the tasks of the plugin instance that ran them", () => {
    clearBackgroundTaskRegistryForTesting()
    rememberBackgroundTask(task({ id: "bg_mine" }), "/repo/a")
    rememberBackgroundTask(task({ id: "bg_theirs" }), "/repo/b")
    archiveBackgroundTask(task({ id: "bg_done", sessionId: "ses_done", status: "completed" }))
    rememberBackgroundTask(task({ id: "bg_done_mine", sessionId: "ses_mine", status: "running" }), "/repo/a")
    archiveBackgroundTask(task({ id: "bg_done_mine", sessionId: "ses_mine", status: "completed" }))
    expect(listRegisteredBackgroundTasks("/repo/a").map((entry) => entry.id)).toEqual(["bg_mine", "bg_done_mine"])
    clearBackgroundTaskRegistryForTesting()
  })

  test("team runs are grouped by lead session and retired runs are left out", async () => {
    const baseDir = scratch()
    writeRun(baseDir, run("11111111-1111-4111-8111-111111111111", "active", "ses_lead"))
    writeRun(baseDir, run("22222222-2222-4222-8222-222222222222", "deleted", "ses_lead"))
    mkdirSync(join(baseDir, "runtime", "broken"), { recursive: true })
    const byLead = await teamRunsByLead(TeamModeConfigSchema.parse({ enabled: true, base_dir: baseDir }))
    expect(byLead.ses_lead).toEqual([
      {
        teamRunId: "11111111-1111-4111-8111-111111111111",
        teamName: "reviewers",
        status: "active",
        members: [
          { name: "lead", sessionID: "ses_lead", status: "running", agentType: "leader" },
          { name: "alice", sessionID: "ses_alice", status: "idle", agentType: "general-purpose" },
        ],
      },
    ])
  })

  test("the publisher writes background.json and teams.json into the state directory", async () => {
    const stateDirectory = join(scratch(), ".omo", "v2-state")
    const baseDir = scratch()
    writeRun(baseDir, run("33333333-3333-4333-8333-333333333333", "active", "ses_lead"))
    const stop = startClientStatePublisher({
      stateDirectory,
      owner: "/repo",
      teamMode: TeamModeConfigSchema.parse({ enabled: true, base_dir: baseDir }),
      readTasks: () => [task({})],
      intervalMs: 10,
    })
    try {
      await waitFor(() => {
        try {
          readFileSync(join(stateDirectory, "teams.json"), "utf8")
          return true
        } catch {
          return false
        }
      })
      expect(JSON.parse(readFileSync(join(stateDirectory, "background.json"), "utf8")).ses_parent[0].id).toBe("bg_1")
      expect(JSON.parse(readFileSync(join(stateDirectory, "teams.json"), "utf8")).ses_lead[0].teamName).toBe("reviewers")
    } finally {
      stop()
    }
  })
})

async function waitFor(ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (ready()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("timed out waiting for client state")
}
