# Client integration API

The OpenCode 2 adapter exposes `omo.client.v1`, a location-scoped plugin RPC.
OmO owns the work state, task execution, goal accounting, continuation policy
and Native prompt generation. A consumer owns its application's metadata,
notifications and presentation selection.

The exported `oh-my-opencode/client-api` module contains `clientRpc`,
`continuationRpc`, Standard Schema definitions and their TypeScript types.
It has no engine initialization or application transport. A consumer can
bundle it or generate a vendored copy:

```bash
node script/export-client-api.mjs /path/to/consumer/vendor
```

The generated `omo-client-api-source.json` records the source path, contract
version and SHA-256. Bundle the portable definition with its Zod dependency;
do not import engine internals to control work.

## Connecting

Subscribe to RPC events before reading `describe({})`. That covers both an
already running OmO and one that registers after the consumer. OpenCode 2.4
activates plugins in the background on a cold location, so an initial
`rpc.unavailable` can precede OmO's `ready` event. After that event, read
`describe` and state again. Consumers supporting older OmO builds can remain
passive when the contract is unavailable; absence is not an empty snapshot.

```ts
import { clientRpc } from "oh-my-opencode/client-api"

const omo = ctx.rpc(clientRpc)
const description = await omo.describe({})
const state = await omo.getState({})
```

OpenCode selects the RPC's location. A plugin's `ctx.rpc` uses its own
location. An external HTTP caller selects the location in the request:

```text
POST /api/rpc/omo.client.v1/describe?location[directory]=<encoded-directory>
Content-Type: application/json

{"input":{}}
```

OpenCode wraps a successful output as `{"output": ...}` and applies its own
authentication and RPC schema validation. A session identifier in an input
does not select another location.

## Operations

- `describe({})` returns version `1`, `instanceID`, directory, effective
  capabilities and the attached consumer, if any. A disabled goal hook does
  not become enabled through this API.
- `getState({sessionID?})` reads tasks, plans, goals, teams and model health.
  The session filter limits session-owned collections; health describes the
  location. Goals include their `id` and `sessionID`, accounting and status.
- `controlGoal` updates or clears an existing goal. It always requires
  `sessionID` and `expectedGoalID`. It cannot create a goal, change accounting
  or write engine-calculated statuses.
- `controlTask` accepts `action: "cancel" | "retry"` and `taskId`. A retry can
  supply a `provider/model` value in `model`.
- `attach` selects presentation and registers the consumer's continuation
  callback. `detach` ends that attachment.

A compound goal update has one object, so conflicting status changes cannot
appear in one command:

```ts
const result = await omo.controlGoal({
  action: "update",
  sessionID,
  expectedGoalID: goal.id,
  objective: "Finish the migration",
  tokenBudget: 100000,
  status: "active",
  attachment,
})
```

The editable fields are `objective`, `tokenBudget` and
`status: "active" | "paused" | "complete"`. At least one is required.
`tokenBudget: null` removes the limit. `action: "clear"` accepts only the
target and optional attachment.

The entire command is validated before mutation. OmO checks that the session
still belongs to the location and that the goal ID still matches. It persists
objective and budget before a resume can wake the continuation loop. Resuming
an already active goal does not grant another continuation allowance.

Goal and task controls return either `{ok: true, ...}` or
`{ok: false, error: {code, message}}`. Domain codes are `unsupported`,
`not_found`, `goal_changed`, `wrong_location`, `client_conflict` and
`stale_attachment`. Malformed input uses OpenCode's RPC validation error.

The schema 2 files under `.omo/v2-state` and the file-based task request
protocol remain available. Both task transports use the same executor.

`defaults.json` in that directory carries OmO's built-in model choice for each
built-in agent and category: `{schema, agents, categories}`, each entry
`{chain, resolved?}`. `chain` is the built-in fallback chain, one
`{providers, model, variant?}` per rung. `resolved` (`{model, variant?}`, with
a `provider/model` ID) is the model that chain selects with the providers
connected now. It is refreshed on the 30-second meta clock and is absent before
OmO knows the connected providers or when no rung is available. User
configuration never enters the file: a consumer can show `resolved` as the
default where the user set no model.

## Attachment and continuation

An attachment is scoped to one OmO execution in one location. Register a
callback RPC with a unique ID before calling `attach`:

```ts
import { continuationRpc } from "oh-my-opencode/client-api"

const callbackID = `consumer.${crypto.randomUUID()}`
const registration = await ctx.rpc.register(continuationRpc(callbackID), {
  beforeGoalContinuation: async (request, context) => {
    await synchronizeSession(request, context.signal)
    return { synchronized: true }
  },
})
const attached = await omo.attach({
  instanceID: description.instanceID,
  clientID: "my-consumer",
  callbackRPCID: callbackID,
  presentation: { surface: "chat" },
})
```

Only one consumer ID can attach at a time. A new execution of the same
consumer can replace its previous execution. Success returns
`attachment: {instanceID, generation}`. Pass this identity with controls
issued by that execution; an obsolete generation cannot change work.
The generation is an ownership check, not an authentication credential.

Before an autonomous goal continuation, OmO calls `beforeGoalContinuation`
with that attachment, `sessionID` and `expectedGoalID`. The callback must
read the consumer's current controls and apply them through `controlGoal`
before acknowledging. A pause persisted before an abort must be visible
before the resulting idle is allowed to continue.

The callback can call OmO reentrantly. OmO holds no mutation lock while
awaiting it, and a resume schedules its wake without awaiting that wake.
Use the callback's cancellation signal and bounded operations. A failed or
timed-out callback blocks that continuation attempt and leaves the goal
intact; it does not detach the consumer. OmO checks the goal and attachment
again after asynchronous inspections and immediately before dispatch.

Accepted `detach(attachment)` invalidates pending callback results, restores
the default presentation for future requests and preserves the goals without
waking them. An obsolete detach returns `{detached: false}`. On shutdown,
dispose the callback registration and release only your own attachment.

## Presentation

Standalone OmO uses the `terminal` Native surface. An attached consumer can
select `chat`. The policy applies to generated Native cores in that OpenCode
location, including auxiliary sessions. It preserves model selection, role
instructions, permissions, custom prompts and external appends.

Changing the surface rebuilds the generated frame on the next request even
when model and tool selection stay the same. It does not rewrite previous
messages. The policy is not per application window; consumers in a different
OpenCode location must attach there separately.

## Events and consumer recovery

`ready` and `stateChanged` contain `instanceID` and `revision`. OpenCode emits
them as `rpc.omo.client.v1.ready` and `rpc.omo.client.v1.stateChanged`.
Filter events by location, and treat them as invalidations: read `getState`
again. They are ephemeral, have no replay and do not promise every
intermediate transition. Reconnect by subscribing and reading state again.

An application adapter that mirrors metadata owns its synchronization,
readback and conflict policy. Whole-record session metadata updates do not
provide compare-and-swap protection against another writer. Removing an
extension is also not a transaction across its host catalog, metadata and
OpenCode's plugin reload. Consumers must document their host's ownership
and unload behavior rather than infer those guarantees from `detach`.
