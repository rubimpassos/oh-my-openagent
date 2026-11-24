# Fork changelog

Releases of [rubimpassos/oh-my-openagent](https://github.com/rubimpassos/oh-my-openagent), the OpenCode 2 line of Oh-My-OpenAgent. Each release is built from `main` (upstream plus this fork's OpenCode 2 work) and tagged `v<upstream version>-fork.<n>`; the `releases` branch always points at the latest one. Install it in `opencode.json`:

```json
{ "plugins": ["oh-my-opencode@git+https://github.com/rubimpassos/oh-my-openagent.git#releases"] }
```

`#releases` follows new releases: OpenCode flags the plugin as outdated when the branch moves, and Update in OpenChamber's Settings → Plugins installs it. Use a tag (`#v5.0.1-fork.1`) to stay on one version or to roll back. Either way the plugin arrives built, so OpenCode loads it without building anything. Upstream's own changes are in [CHANGELOG.md](CHANGELOG.md).

To release: add a `## [<version>] - YYYY-MM-DD` section here on `main` (with the `Fork-Patch: v2-support` trailer), then run the **Fork release** workflow with that version.

## [5.1.69-fork.16] - 2026-11-24

### Built-in model defaults for clients

- OmO publishes `defaults.json` beside the other schema 2 files in
  `.omo/v2-state`: for each built-in agent and category, its built-in model
  chain and the model that chain resolves to with the providers connected
  now. User configuration never enters the file; it refreshes every 30
  seconds, so a provider connected later appears within that interval. See
  the [client integration API](docs/reference/client-api.md).
- The OpenChamber extension 0.7.0 shows that model as each unset agent's or
  category's "OMO default", and recommends it where your first choice
  differs. Older extensions ignore the file.

## [5.1.69-fork.15] - 2026-11-24

### Client integration API

- Exposes the location-scoped [client integration API](docs/reference/client-api.md)
  `omo.client.v1` RPC for state, task controls,
  existing-goal controls and consumer presentation. The portable contract is
  exported as `oh-my-opencode/client-api`; schema 2 state files and task
  request files remain supported.
- OmO owns execution, accounting and Native prompt generation. Consumer
  extensions own their application's metadata and notifications. The
  OpenChamber bridge now ships in `openchamber-omo` 0.6.0.
- Standalone Native prompts use the terminal surface. An attached consumer
  can select chat through the neutral API. Runtime model changes preserve
  the selected surface, roles, appends and permission filtering.
- Client synchronization runs before autonomous continuation. Callback
  failure, goal replacement and stale attachment responses cannot authorize
  a pending dispatch. Compound objective, budget and resume changes persist
  before the loop wakes; repeated resume of an active goal preserves its
  continuation allowance.
- Sisyphus determines intent internally and retains its routing and explicit
  implementation authorization rules.

### Updating

Update the OpenChamber extension to 0.6.0 and approve its new **Add a plugin
to OpenCode** capability before updating OmO. The extension requires the
OpenChamber fork 2.7.11 or newer. It remains passive with earlier OmO builds,
which continue to use their existing integration. Update OmO through
Settings → Plugins.

The extension documents the host's full-record metadata and non-transactional
unload behavior, including automatic driver takeover. This release does not
change that OpenChamber policy.

### Validation

- 311 scoped OmO tests, source/script typechecks, builds and declaration
  generation passed. The extension passed 113 tests plus the compiled-entry
  checks. Real isolated OpenCode 2.4 and OpenChamber 2.7.11 exercised RPC,
  goal controls, task cancel/retry, presentation and host notifications.
- The provider was a local scripted protocol fixture. Real LLM instruction
  following and desktop OS notification presentation were not evaluated.

## [5.1.69-fork.14] - 2026-11-13

### Updates

- Integrates upstream `dev` through `2353fa52bddbba8cfa50f51f5b9d8271b1e476fc`, including the 5.1.69 release and subsequent merged updates. The fork keeps its functional OpenCode V2 runtime instead of upstream's load-only entry and migration notice.
- Retains the fork's session-scoped goals, pause and resume controls, todos and plans that follow moved sessions, exact plan selection, external browser provider and domain-language planning.
- Uses the current upstream build graph and plugin SDK while retaining the built Git release installation path. The release workflow uses Bun 1.4.4.
- Scheduled synchronization now merges both upstream and open V2 PR updates onto the validated fork history and proposes a reviewable PR instead of rebuilding and force-pushing `main` from the old PR base.

### Fixes

- Configuration migration with `OMO_CONFIG_DIR` now returns the complete current migration result, including its empty target-backup list.
- Internal session HTTP requests honor OpenCode V2's `OPENCODE_PASSWORD`, with the V2 username and precedence, while retaining legacy authentication. This fixes unauthorized session listing and metadata requests when the V2 password variable is used.
- Codex cleanup does not attempt to prune `/runtime` when its configured home resolves to a filesystem root.
- Goal continuation tests clean up their temporary project directories, as required by the current upstream isolation checks.

### Validation and known limitations

- The functional V2 port passed 687 focused regressions, complete build/typecheck and real isolated OpenCode tool/hook execution. Codex unit and live-hook checks also passed.
- The complete Senpi run observed 8408 pass, 8 skip and 10 fail. Five migration-fixture failures were corrected without changing assertions; the predecessor and complete startup test scope then passed 29 tests. The other five failures reproduce unchanged on pinned upstream in this hardened VPS. No aggregate post-fix full-suite result is claimed, and neither the full Senpi gate nor the global upstream suite is green.
- In nested user namespaces without root attestation, upstream Senpi reflection/memory can refuse execution with `trust-userns-unattested`. With restricted process visibility, some local telemetry queues can remain when owner identity cannot be verified. Security protections and failing assertions were not relaxed for this release.

## [5.0.1-fork.13] - 2026-10-31

### Fixes

- Pausing a goal now stops automatic Todo and Atlas continuations as well as goal continuations. Pending dispatches synchronize the goal state and check the pause immediately before sending, so an idle event or an already-armed countdown cannot restart a paused goal. Explicit resume and background task result notifications keep working.

## [5.0.1-fork.12] - 2026-10-30

### Fixes

- `/ulw-execute ".omo/plans/auth.md"` now selects that exact worktree-relative plan instead of a newer same-name legacy plan, a case-only sibling or an existing work for a different file. Missing or invalid exact paths do not fall back to another plan, and stored or explicit worktrees cannot redirect the selection to a different file. Basename and partial-name selection keep their existing behavior.
- Quoted plan filenames preserve spaces, literal quotes, `ulw` and embedded flag names; only standalone `--worktree`, `--make-pr` and `--ship` arguments activate those options. This gives clients such as OpenChamber a native exact-path selector without changing their plan-selection UI in this release.

## [5.0.1-fork.11] - 2026-10-22

### Fixes

- A session moved to another folder (from a worktree to the main checkout, or back) now takes its OMO state along: its goal, todo list, `/stop-continuation` state, subagent links and the Atlas plan it is executing, with a copy of the plan file and notepad when they live in the old folder's `.omo/`. Before, the new folder saw none of it: `get_goal` and `todoread` came back empty, the plan stopped, the old folder kept continuing the goal, and deleting the worktree lost the plan.

## [5.0.1-fork.10] - 2026-10-22

### Fixes

- A session moved to another folder (a worktree, or back to the main checkout) no longer keeps getting "Todo continuation" prompts after its todo list is done. The list stayed behind in the old folder, still pending, and OMO kept continuing it from there. A session now has one todo list wherever it moves, and a deleted session's list is removed. Lists already left behind stop counting the next time their session updates its todos.

## [5.0.1-fork.9] - 2026-10-22

### Features

- Prometheus (ulw-plan) now plans in the project's domain language. It reads `GLOSSARY.md` (or `GLOSSARY-MAP.md`) and the relevant `docs/adr/` while exploring, challenges terms that conflict with the glossary or mean two things, and names every concept the same way across the plan. New or changed terms and hard-to-reverse decisions are collected in the draft and written to `GLOSSARY.md` and `docs/adr/` by the plan's first wave, so you approve them with the plan. Prometheus itself still writes only under `.omo/`. Adapted from the domain-modeling skill in mattpocock/skills.

## [5.0.1-fork.8] - 2026-10-21

### Fixes

- Creating, reading or updating a goal now targets the session that called the tool, even when another session was opened afterward. Goals no longer appear in an unrelated chat because it became the global main session. Explicit session targeting is unchanged.

## [5.0.1-fork.7] - 2026-10-14

### Fixes

- On a headless Linux server, OMO no longer builds desktop notifications nobody can see. Building one read the whole session history at the end of every turn, which stalled OpenCode in sessions with image attachments. OpenChamber's notifications are unaffected.

## [5.0.1-fork.6] - 2026-10-14

### Fixes

- The end of every turn no longer stalls OpenCode in sessions with image attachments. The todo continuation read the whole session history before checking for pending todos; it now reads the history only when there are todos to continue.

## [5.0.1-fork.5] - 2026-10-14

### Fixes

- The fork.4 fix now also covers sessions that never switched agents, such as sessions created through the API, which still read their whole history on every tool call.

## [5.0.1-fork.4] - 2026-10-14

### Fixes

- Tool calls no longer stall OpenCode in sessions with image attachments. Atlas and the Prometheus guard read the whole session history on every tool call to learn which agent was running, and OpenCode revalidates every stored image on each read. They now read the session's current agent.

## [5.0.1-fork.3] - 2026-10-14

### Fixes

- The sidebar no longer keeps a CPU core busy in sessions with image attachments. It read each active session's whole history every two seconds just to show the agent's name, and OpenCode revalidates every stored image on each read. It now reads the session's current agent instead.

## [5.0.1-fork.2] - 2026-10-13

### Fixes

- Pause and Resume on an OMO goal in OpenChamber now take effect. Pause no longer flips back to active or lets the next continuation through, and Resume continues an idle session right away instead of waiting for an event that never came.

## [5.0.1-fork.1] - 2026-10-11

**The first release of the OpenCode 2 line.** Until now the fork ran from a checkout built on the machine. It now ships as built releases that OpenCode installs and updates from the repository.

### New

- Runs on OpenCode 2: delegation, background tasks, team mode and every OMO tool work, and the tools are offered to the model directly instead of through Code Mode.
- Publishes its state for clients such as OpenChamber in `.omo/v2-state`: todos, background tasks with every retry attempt, team runs with unread messages, Atlas plans, goals, model health and the config files it loads.
- Cancel and retry background tasks from a client: a retry runs on a model of the category that is not failing.
- `/goal` tracks tokens and time, waits for its background tasks, and stops at a token budget or a turn cap. In OpenChamber it shows and is controlled with OpenChamber's own goal UI.
- Native notifications in OpenChamber when a background task fails, a chat's tasks all finish, a plan completes or a goal settles.
- `browser_automation_engine.provider: "external"` leaves browsing to another plugin, such as OpenChamber's browser.
- `OMO_CONFIG_DIR` points OMO at its own config folder.

### Fixes

- Tool results reach the model as text, not as a JSON dump of their parts, and tool metadata no longer breaks recording a background launch.
- Projected tools carry their real parameter schema, so `task` runs in the background when asked.
- `todowrite` returns the saved list, like it did on OpenCode 1.
- A goal is no longer replaced by the next ordinary message, and its loop keeps going after short turns.
