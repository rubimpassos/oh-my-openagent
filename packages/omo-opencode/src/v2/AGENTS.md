# OpenCode 2 adapter

`host.ts` projects the V1 implementation onto the public OpenCode 2 plugin API.
`hook-bridge.ts` maps lifecycle/tool hooks and `context-hook.ts` reconciles Native
prompts after V1 transforms. Preserve location filtering and session-move handling.

`client-api-contract.ts` owns the portable `omo.client.v1` Standard Schema
definition. `client-api.ts` registers it; the goal controller and background
manager remain the owners of mutations. `client-state.ts` and the publisher
retain the schema 2 file protocol. RPC invalidations do not replace storage.

Consumers own application metadata, notification transitions, credentials,
transport and their chosen presentation. Do not detect an application through
environment variables or add its session metadata protocol here. The standalone
Native surface is terminal; a location's active attachment may select chat.

The pre-continuation callback must remain reentrant: never await a client while
holding a mutation lock, or await the resume wake from its RPC handler. Failed
callbacks block the attempt. After every await, preserve checks on attachment
generation, goal ID and location. A stale detach cannot remove its successor.

The public contract is also exported as `oh-my-opencode/client-api`. Generate
consumer copies with `node script/export-client-api.mjs <vendor-directory>` and
verify bytes against the source hash. Contract edits must update real consumers.
See `docs/reference/client-api.md` for the protocol and ownership guarantees.

QA uses real OpenCode in isolated HOME/XDG directories, with evidence under the
ignored `.omo/evidence/`. Unit tests and typechecks alone do not prove the plugin
registration, callback transport or generated request context.

The runnable plugin payload includes `dist/skills/`, supplied by
`bun run build:shared-skills-assets` after bundling. Native skill loading reads
these files during import. OpenCode 2.4 activates plugins asynchronously:
subscribe to the RPC `ready` event before discovery and inspect plugin load
errors when it never arrives.

Use a locally packed release payload for managed-host integration QA. OpenCode
watches configured plugin directories recursively; a full source checkout with
dependencies can stall native watcher startup. Keep watches enabled and record
the packed bundle's equality with the local build.
