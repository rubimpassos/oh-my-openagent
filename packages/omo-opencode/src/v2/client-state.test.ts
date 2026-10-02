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
import { backgroundTasksByParent, configPathsOf, goalsBySession, plansBySession, startClientStatePublisher, teamRunsByLead } from "./client-state"

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

  test("meta.json names the user config file this instance loads", async () => {
    const stateDirectory = join(scratch(), ".omo", "v2-state")
    const configDirectory = scratch()
    const previous = process.env.OMO_CONFIG_DIR
    process.env.OMO_CONFIG_DIR = configDirectory
    try {
      expect(configPathsOf("/repo").userConfigPath).toBe(join(configDirectory, "omo.jsonc"))
      writeFileSync(join(configDirectory, "omo.json"), "{}")
      expect(configPathsOf("/repo").userConfigPath).toBe(join(configDirectory, "omo.json"))
      const stop = startClientStatePublisher({ stateDirectory, owner: "/repo", readTasks: () => [], intervalMs: 10 })
      try {
        await waitFor(() => {
          try {
            readFileSync(join(stateDirectory, "meta.json"), "utf8")
            return true
          } catch {
            return false
          }
        })
        const meta = JSON.parse(readFileSync(join(stateDirectory, "meta.json"), "utf8"))
        expect(meta.userConfigPath).toBe(join(configDirectory, "omo.json"))
        expect(Array.isArray(meta.projectConfigPaths)).toBe(true)
      } finally {
        stop()
      }
    } finally {
      if (previous === undefined) delete process.env.OMO_CONFIG_DIR
      else process.env.OMO_CONFIG_DIR = previous
    }
  })

  test("a retried task lists every attempt with its session and model", () => {
    const [entry] = backgroundTasksByParent([task({
      model: { providerID: "anthropic", modelID: "claude-haiku-4-5" },
      attempts: [
        { attemptId: "a1", attemptNumber: 1, sessionId: "ses_a1", providerId: "zai", modelId: "glm-5.3", status: "error", error: "no balance" },
        { attemptId: "a2", attemptNumber: 2, sessionId: "ses_a2", providerId: "anthropic", modelId: "claude-haiku-4-5", status: "running" },
      ],
    })]).ses_parent ?? []
    expect(entry?.model).toBe("anthropic/claude-haiku-4-5")
    expect(entry?.attempts).toEqual([
      { number: 1, status: "error", sessionID: "ses_a1", model: "zai/glm-5.3", error: "no balance" },
      { number: 2, status: "running", sessionID: "ses_a2", model: "anthropic/claude-haiku-4-5" },
    ])
  })

  test("an Atlas plan is published for every session working on it, with checklist progress", () => {
    const directory = scratch()
    mkdirSync(join(directory, ".omo/plans"), { recursive: true })
    writeFileSync(join(directory, ".omo/plans/auth.md"), "# Auth\n\n- [x] write tests\n- [ ] ship it\n")
    writeFileSync(join(directory, ".omo/boulder.json"), JSON.stringify({
      schema_version: 2,
      active_work_id: "auth-1",
      works: {
        "auth-1": {
          work_id: "auth-1",
          active_plan: join(directory, ".omo/plans/auth.md"),
          plan_name: "auth",
          status: "active",
          started_at: "2026-10-01T10:00:00.000Z",
          session_ids: ["opencode:ses_lead"],
          task_sessions: {
            t1: { task_key: "t1", task_label: "1", task_title: "write tests", session_id: "opencode:ses_worker", agent: "Sisyphus-Junior", category: "quick", status: "completed", updated_at: "2026-10-01T10:05:00.000Z" },
          },
        },
      },
    }))
    const plan = plansBySession(directory).ses_lead
    expect(plan?.planName).toBe("auth")
    expect(plan?.total).toBe(2)
    expect(plan?.completed).toBe(1)
    expect(plan?.nextTask).toBe("ship it")
    expect(plan?.tasks).toEqual([{ key: "t1", label: "1", title: "write tests", status: "completed", sessionID: "ses_worker", agent: "Sisyphus-Junior", category: "quick" }])
  })

  test("the /goal of each session is published from .omo/goal", () => {
    const directory = scratch()
    mkdirSync(join(directory, ".omo/goal"), { recursive: true })
    const goal = { id: "g1", sessionID: "ses_goal", objective: "make the build green", status: "active", tokensUsed: 1200, timeUsedSeconds: 90, createdAt: 1, updatedAt: 2 }
    writeFileSync(join(directory, ".omo/goal/ses_goal.json"), JSON.stringify({ version: 1, goal }))
    writeFileSync(join(directory, ".omo/goal/ses_none.json"), JSON.stringify({ version: 1, goal: null }))
    writeFileSync(join(directory, ".omo/goal/broken.json"), "{")
    expect(goalsBySession(directory)).toEqual({
      ses_goal: { objective: "make the build green", status: "active", tokensUsed: 1200, turnsUsed: 0, timeUsedSeconds: 90, createdAt: 1, updatedAt: 2 },
    })
    expect(goalsBySession(scratch())).toEqual({})
  })
})

async function waitFor(ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (ready()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("timed out waiting for client state")
}
