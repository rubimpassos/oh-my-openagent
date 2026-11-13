import { afterEach, describe, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "zod"

const workflow = z.object({
  permissions: z.object({ "pull-requests": z.literal("write") }),
  jobs: z.object({ sync: z.object({ steps: z.array(z.object({
    id: z.string().optional(), run: z.string().optional(), if: z.string().optional(),
    uses: z.string().optional(), env: z.record(z.string(), z.string()).optional(),
    with: z.record(z.string(), z.unknown()).optional(),
    "continue-on-error": z.literal(false).optional(),
  })) }) }),
}).parse(Bun.YAML.parse(readFileSync(new URL("../.github/workflows/fork-sync.yml", import.meta.url), "utf8")))
const roots = new Set<string>()
afterEach(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); roots.clear() })

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "fork-sync-"))
  roots.add(root)
  const repo = join(root, "repo")
  const remote = join(root, "remote.git")
  const bin = join(root, "bin")
  mkdirSync(repo); mkdirSync(bin)
  const env = {
    PATH: `${bin}:/usr/bin:/bin`, HOME: root, GIT_MASTER: "1", GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_EDITOR: "true",
    GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "fixture@example.test",
    GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "fixture@example.test",
    GITHUB_REPOSITORY: "fixture/fork", GITHUB_RUN_ID: "17", GITHUB_RUN_ATTEMPT: "1",
    GITHUB_SERVER_URL: "https://example.test", BRANCH: "main", UPSTREAM: "fixture/upstream",
    PR_NUMBER: "9016", PR_STATE: "OPEN", PENDING: "0", FAIL_GATE: "", CALLS: join(root, "calls"),
  }
  function run(command: readonly string[]) {
    const result = Bun.spawnSync([...command], { cwd: repo, env })
    if (result.exitCode !== 0) throw new Error(result.stderr.toString() + result.stdout.toString())
    return result.stdout.toString().trim()
  }
  const git = (...args: string[]) => run(["git", "-c", "commit.gpgsign=false", ...args])
  function commit(path: string, value: string) {
    mkdirSync(join(repo, path, ".."), { recursive: true })
    writeFileSync(join(repo, path), value)
    git("add", path); git("commit", "-qm", path)
    return git("rev-parse", "HEAD")
  }
  git("init", "-q", "-b", "main")
  git("config", "commit.gpgsign", "false")
  git("config", "core.hooksPath", join(root, "no-hooks"))
  git("init", "--bare", "-q", remote)
  git("remote", "add", "origin", remote)
  git("config", `url.${remote}.insteadOf`, "https://github.com/fixture/upstream.git")
  commit("shared.txt", "base\n")
  commit(".github/workflows/fork-sync.yml", "fork sync\n")
  commit(".github/workflows/fork-release.yml", "fork release\n")
  git("branch", "dev"); git("branch", "pr")
  commit("shared.txt", "fork\n")
  const main = commit("fork.txt", "validated fork\n")
  git("push", "-q", "origin", "main", "dev")
  git("push", "-q", "origin", "pr:refs/pull/9016/head")
  for (const [name, script] of Object.entries({
    gh: `#!/bin/bash
set -eu
printf '%s\\n' "$*" >> "$CALLS"
case "$1 $2" in
  'pr list') echo "$PENDING" ;;
  'pr view') echo "$PR_STATE" ;;
  'pr create'|'issue list'|'issue create'|'issue comment') ;;
  *) exit 90 ;;
esac
`,
    bun: `#!/bin/bash
set -eu
printf '%s\\n' "$*" >> "$CALLS"
case "$*" in
  'install --frozen-lockfile --ignore-scripts') [ "$FAIL_GATE" != install ] ;;
  'test script/fork-sync.test.ts packages/omo-opencode/src/v2 packages/omo-config-core/src/loader') [ "$FAIL_GATE" != test ] ;;
  *) exit 91 ;;
esac
`,
  })) {
    writeFileSync(join(bin, name), script); chmodSync(join(bin, name), 0o755)
  }
  function advance(branch: string, path: string, value: string) {
    git("checkout", "-q", branch)
    const sha = commit(path, value)
    git("push", "-q", "origin", branch === "pr" ? "HEAD:refs/pull/9016/head" : branch)
    return sha
  }
  function drive() {
    const values: Record<string, string> = {}
    let failed = false
    const interpolate = (text: string) => text.replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, key: string) => values[key] ?? "")
    function condition(expression: string): boolean {
      return expression.split(" || ").some(group => group.split(" && ").every(part => {
        if (part === "failure()") return failed
        const match = /^(\S+) (==|!=) '([^']*)'$/.exec(part)
        if (!match) throw new Error(`Unsupported workflow condition: ${part}`)
        const [, key = "", operator, expected] = match
        return operator === "==" ? (values[key] ?? "") === expected : (values[key] ?? "") !== expected
      }))
    }
    for (const step of workflow.jobs.sync.steps) {
      if (step.if ? !condition(step.if) || (failed && !step.if.includes("failure()")) : failed) continue
      if (step.uses === "oven-sh/setup-bun@v2") expect(step.with?.["bun-version"]).toBe("1.4.4")
      if (!step.run || !step.id) continue
      const output = join(root, `${step.id}.out`)
      writeFileSync(output, "")
      const result = Bun.spawnSync(["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", step.run], {
        cwd: repo, env: { ...env, ...Object.fromEntries(Object.entries(step.env ?? {}).map(([k, v]) => [k, interpolate(v)])), GITHUB_OUTPUT: output },
      })
      values[`steps.${step.id}.outcome`] = result.exitCode === 0 ? "success" : "failure"
      if (result.exitCode !== 0) failed = true
      for (const line of readFileSync(output, "utf8").trim().split("\n")) {
        const index = line.indexOf("=")
        if (index >= 0) values[`steps.${step.id}.outputs.${line.slice(0, index)}`] = line.slice(index + 1)
      }
    }
    expect(git("ls-remote", "origin", "refs/heads/main").split("\t")[0]).toBe(main)
    return { failed, values, calls: readFileSync(env.CALLS, "utf8"), published: git("ls-remote", "origin", "refs/heads/fork-sync/*") }
  }
  return { root, repo, env, git, main, advance, drive }
}

describe("fork sync real Git integration", () => {
  test("preserves fork, upstream and open PR history in a review branch", () => {
    // given
    const f = fixture()
    const upstream = f.advance("dev", "upstream.txt", "new upstream\n")
    f.advance("dev", ".github/workflows/publish.yml", "upstream publishing\n")
    const pr = f.advance("pr", "v2.txt", "new V2\n")
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(false)
    expect(result.published).not.toBe("")
    for (const sha of [f.main, upstream, pr]) expect(f.git("merge-base", "--is-ancestor", sha, "HEAD")).toBe("")
    expect(f.git("ls-tree", "--name-only", "HEAD:.github/workflows").split("\n")).toEqual(["fork-release.yml", "fork-sync.yml"])
    expect(f.git("show", "HEAD:fork.txt")).toBe("validated fork")
    expect(f.git("show", "HEAD:upstream.txt")).toBe("new upstream")
    expect(f.git("show", "HEAD:v2.txt")).toBe("new V2")
    expect(result.calls).toContain("pr create -R fixture/fork --base main --head fork-sync/17-1")
  })

  test.each(["CLOSED", "MERGED"])("ignores PR updates when PR is %s", state => {
    // given
    const f = fixture(); f.env.PR_STATE = state
    f.advance("dev", "upstream.txt", "new upstream\n")
    f.advance("pr", "v2.txt", "unmerged PR\n")
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(false)
    expect(f.git("ls-tree", "--name-only", "HEAD").split("\n")).not.toContain("v2.txt")
    expect(f.git("show", "HEAD:upstream.txt")).toBe("new upstream")
  })

  test("publishes nothing when both sources are already ancestors", () => {
    // given
    const f = fixture()
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(false)
    expect(result.values["steps.integrate.outputs.unchanged"]).toBe("true")
    expect(result.published).toBe("")
    expect(result.calls).not.toContain("install")
  })

  test.each(["dev", "pr"])("reports %s conflicts without publishing or changing main", branch => {
    // given
    const f = fixture()
    if (branch === "pr") f.advance("dev", "upstream.txt", "new upstream\n")
    f.advance(branch, "shared.txt", "conflicting source\n")
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(true)
    expect(result.values["steps.integrate.outputs.conflict"]).toBe(`upstream/${branch}`)
    expect(result.published).toBe("")
    expect(result.calls).toContain("issue create")
    expect(f.git("diff", "--name-only", "--diff-filter=U")).toBe("")
  })

  test("skips integration while a sync PR awaits review", () => {
    // given
    const f = fixture(); f.env.PENDING = "1"
    f.advance("dev", "upstream.txt", "new upstream\n")
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(false)
    expect(result.values["steps.sources.outcome"]).toBeUndefined()
    expect(result.published).toBe("")
  })

  test("preserves an existing divergent candidate branch instead of forcing a push", () => {
    // given
    const f = fixture(); f.env.PR_STATE = "CLOSED"
    const previous = f.advance("pr", "review.txt", "existing review\n")
    f.git("push", "-q", "origin", "pr:refs/heads/fork-sync/17-1")
    f.advance("dev", "upstream.txt", "new upstream\n")
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(true)
    expect(result.published.split("\t")[0]).toBe(previous)
    expect(result.calls).not.toContain("pr create")
  })

  test("retains upstream ancestry when its only tree change is an excluded workflow", () => {
    // given
    const f = fixture()
    const upstream = f.advance("dev", ".github/workflows/publish.yml", "upstream publishing\n")
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(false)
    expect(result.published).not.toBe("")
    expect(f.git("rev-parse", "HEAD^{tree}")).toBe(f.git("rev-parse", `${f.main}^{tree}`))
    expect(f.git("merge-base", "--is-ancestor", upstream, "HEAD")).toBe("")
  })

  test.each(["install", "test"])("reports a failed %s gate without publishing", failure => {
    // given
    const f = fixture(); f.env.FAIL_GATE = failure
    f.advance("dev", "upstream.txt", "new upstream\n")
    // when
    const result = f.drive()
    // then
    expect(result.failed).toBe(true)
    expect(result.published).toBe("")
    expect(result.calls).toContain("issue create")
    if (failure === "install") expect(result.calls).not.toContain("test script/")
  })
})
