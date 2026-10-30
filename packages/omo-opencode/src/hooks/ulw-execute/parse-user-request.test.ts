/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { parseUserRequest } from "./parse-user-request"

describe("parseUserRequest", () => {
  test.each([
    ".omo/plans/a'b'c.md",
    '.omo/plans/a"b"c.md',
    '.omo/plans/a`b`c.md',
    '.omo/plans/a"--ship"--make-pr.md',
    '.omo/plans/a\\"b.md',
  ])("preserves interior literal quotes when parsing %s", (path) => {
    // given
    const request = `<user-request>${path}</user-request>`
    // when
    const result = parseUserRequest(request)
    // then
    expect(result).toEqual({ planName: path, explicitWorktreePath: null, makePr: false, ship: false })
  })

  test.each([
    '.omo/plans/a"b"c.md',
    '.omo/plans/a\\"b.md',
    '.omo/plans/a\\b\\.md',
    '.omo/plans/a " --ship --make-pr --worktree " ulw `b`\'c.md',
  ])("decodes JSON-quoted exact selectors when parsing %s", (path) => {
    // given
    const request = `<user-request>${JSON.stringify(path)} --make-pr</user-request>`
    // when
    const result = parseUserRequest(request)
    // then
    expect(result).toEqual({ planName: path, explicitWorktreePath: null, makePr: true, ship: false })
  })

  test.each(['"', "'", '`'])("preserves literal backslashes and flag names inside %s wrappers", (quote) => {
    // given
    const path = '.omo/plans/a\\temp --ship --worktree.md'
    // when
    const result = parseUserRequest(`<user-request>${quote}${path}${quote}</user-request>`)
    // then
    expect(result).toEqual({ planName: path, explicitWorktreePath: null, makePr: false, ship: false })
  })

  test.each([
    '".omo/plans/auth.md',
    "'.omo/plans/auth.md",
    '`.omo/plans/auth.md',
    '".omo/plans/auth.md"suffix --ship',
    '".omo/plans/auth.md"" --make-pr',
    '--ship ".omo/plans/a\\"b.md',
    'auth --worktree "unterminated --make-pr',
  ])("retains the raw selector without activating flags when quoting is malformed: %s", (argument) => {
    // given
    const request = `<user-request>${argument}</user-request>`
    // when
    const result = parseUserRequest(request)
    // then
    expect(result).toEqual({ planName: argument, explicitWorktreePath: null, makePr: false, ship: false })
  })

  test.each([
    '.omo/plans/ulw-auth.md',
    '.omo/plans/ultrawork.md',
    '.omo/plans/auth--ship.md',
    '.omo/plans/auth--make-pr.md',
    '.omo/plans/auth--worktree.md',
    '".omo/plans/ulw ultrawork --ship --make-pr --worktree.md"',
    "'.omo/plans/auth plan.md'",
    '`./.omo/plans/auth plan.md`',
    '.omo\\plans\\auth.md',
  ])("preserves literal plan token %s when parsing", (argument) => {
    // given
    const expected = argument.replace(/^["'`]|["'`]$/g, "")
    // when
    const result = parseUserRequest(`<user-request>${argument}</user-request>`)
    // then
    expect(result).toEqual({ planName: expected, explicitWorktreePath: null, makePr: false, ship: false })
  })

  test("parses standalone flags with a quoted worktree when the plan embeds flag names", () => {
    // given
    const request = 'ulw ".omo/plans/ulw --ship.md" --ship --make-pr --worktree "/tmp/work tree"'
    // when
    const result = parseUserRequest(`<user-request>${request}</user-request>`)
    // then
    expect(result).toEqual({ planName: ".omo/plans/ulw --ship.md", explicitWorktreePath: "/tmp/work tree", makePr: true, ship: true })
  })

  test("keeps standalone delivery flags when worktree has no value", () => {
    // given
    const request = "auth --worktree --ship --make-pr"
    // when
    const result = parseUserRequest(`<user-request>${request}</user-request>`)
    // then
    expect(result).toEqual({ planName: "auth", explicitWorktreePath: null, makePr: true, ship: true })
  })
  describe("when no user-request tag", () => {
    test("#given prompt without tag #when parsing #then returns nulls", () => {
      const result = parseUserRequest("Just a regular message without any tags")
      expect(result.planName).toBeNull()
      expect(result.explicitWorktreePath).toBeNull()
    })
  })

  describe("when user-request tag is empty", () => {
    test("#given empty user-request tag #when parsing #then returns nulls", () => {
      const result = parseUserRequest("<user-request>  </user-request>")
      expect(result.planName).toBeNull()
      expect(result.explicitWorktreePath).toBeNull()
    })
  })

  describe("when only plan name given", () => {
    test("#given plan name without worktree flag #when parsing #then returns plan name with null worktree", () => {
      const result = parseUserRequest("<session-context>\n<user-request>my-plan</user-request>\n</session-context>")
      expect(result.planName).toBe("my-plan")
      expect(result.explicitWorktreePath).toBeNull()
    })
  })

  describe("when only --worktree flag given", () => {
    test("#given --worktree with path only #when parsing #then returns worktree path with null plan", () => {
      const result = parseUserRequest("<user-request>--worktree /home/user/repo-feat</user-request>")
      expect(result.planName).toBeNull()
      expect(result.explicitWorktreePath).toBe("/home/user/repo-feat")
    })
  })

  describe("when plan name and --worktree are both given", () => {
    test("#given plan name before --worktree #when parsing #then returns both", () => {
      const result = parseUserRequest("<user-request>my-plan --worktree /path/to/worktree</user-request>")
      expect(result.planName).toBe("my-plan")
      expect(result.explicitWorktreePath).toBe("/path/to/worktree")
    })

    test("#given --worktree before plan name #when parsing #then returns both", () => {
      const result = parseUserRequest("<user-request>--worktree /path/to/worktree my-plan</user-request>")
      expect(result.planName).toBe("my-plan")
      expect(result.explicitWorktreePath).toBe("/path/to/worktree")
    })
  })

  describe("when plan name is wrapped in quotes", () => {
    test("#given quoted plan name #when parsing #then strips wrapping quotes", () => {
      const result = parseUserRequest("<user-request>\"my feature plan\"</user-request>")
      expect(result.planName).toBe("my feature plan")
      expect(result.explicitWorktreePath).toBeNull()
    })
  })

  describe("when --worktree flag has no path", () => {
    test("#given --worktree without path #when parsing #then worktree path is null", () => {
      const result = parseUserRequest("<user-request>--worktree</user-request>")
      expect(result.explicitWorktreePath).toBeNull()
    })
  })

  describe("when PR delivery flags are present", () => {
    test("#given --make-pr alone #when parsing #then makePr is true with null plan name", () => {
      const result = parseUserRequest("<user-request>--make-pr</user-request>")
      expect(result.planName).toBeNull()
      expect(result.makePr).toBe(true)
      expect(result.ship).toBe(false)
    })

    test("#given plan name with --make-pr #when parsing #then strips flag from plan name", () => {
      const result = parseUserRequest("<user-request>my-plan --make-pr</user-request>")
      expect(result.planName).toBe("my-plan")
      expect(result.makePr).toBe(true)
    })

    test("#given --ship with plan name and worktree #when parsing #then all parts parsed", () => {
      const result = parseUserRequest("<user-request>my-plan --ship --worktree /path/to/wt</user-request>")
      expect(result.planName).toBe("my-plan")
      expect(result.ship).toBe(true)
      expect(result.makePr).toBe(false)
      expect(result.explicitWorktreePath).toBe("/path/to/wt")
    })

    test("#given --make-pr and --ship together #when parsing #then both flags true", () => {
      const result = parseUserRequest("<user-request>--make-pr --ship my-plan</user-request>")
      expect(result.planName).toBe("my-plan")
      expect(result.makePr).toBe(true)
      expect(result.ship).toBe(true)
    })

    test("#given no delivery flags #when parsing #then flags default false", () => {
      const result = parseUserRequest("<user-request>my-plan</user-request>")
      expect(result.makePr).toBe(false)
      expect(result.ship).toBe(false)
    })
  })

  describe("when ultrawork keywords are present", () => {
    test("#given plan name with ultrawork keyword #when parsing #then strips keyword from plan name", () => {
      const result = parseUserRequest("<user-request>my-plan ultrawork</user-request>")
      expect(result.planName).toBe("my-plan")
    })

    test("#given plan name with ulw keyword and worktree #when parsing #then strips ulw, preserves worktree", () => {
      const result = parseUserRequest("<user-request>my-plan ulw --worktree /path/to/wt</user-request>")
      expect(result.planName).toBe("my-plan")
      expect(result.explicitWorktreePath).toBe("/path/to/wt")
    })

    test("#given only ultrawork keyword with worktree #when parsing #then plan name is null, worktree preserved", () => {
      const result = parseUserRequest("<user-request>ultrawork --worktree /wt</user-request>")
      expect(result.planName).toBeNull()
      expect(result.explicitWorktreePath).toBe("/wt")
    })
  })
})
