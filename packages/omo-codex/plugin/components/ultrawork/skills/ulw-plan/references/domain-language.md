---
name: ulw-plan
description: ulw-plan domain-language discipline - read the project glossary and ADRs while grounding, sharpen terms during planning, keep a Domain language ledger in the draft, and hand glossary/ADR writes to the executor through the plan.
metadata:
  short-description: Shared domain language and decision records for ulw-plan
---

# ulw-plan - domain language

Both intent paths read this. A plan written in the project's own words keeps names, files, and later conversations consistent, and lets the executor spend fewer tokens decoding jargon. The planner builds that shared language while it plans, and records hard-to-reverse decisions so nobody "fixes" them later.

You still write ONLY under `.omo/`. The glossary and decision records are product files: you collect them in the draft ledger, and the plan hands the actual write to the executor as a todo. The user approves the language together with the plan.

## Discover (Phase 1, alongside the rest of grounding)

Resolve the glossary layout once per plan, in this order:

1. `GLOSSARY-MAP.md` at the repo root -> multi-context repo. Read it, pick the context(s) the request touches, read each context's `GLOSSARY.md`. If the request spans contexts and the map does not say which owns a term, that is a question (CLEAR) or an announced default (UNCLEAR).
2. Else a root `GLOSSARY.md` -> single context. Read it.
3. Else no glossary yet. Nothing to read; the first resolved term will create one (lazily, through the plan).

Then list `docs/adr/` (and the context's own `docs/adr/` in a multi-context repo). Read the titles, and read in full every ADR in the area the request touches. An accepted ADR is a constraint, the same as a mandated stack: the plan respects it or names it as superseded with a reason.

Record what you found in the draft's `## Domain language` ledger (`Sources:` line). Absence is a finding too: write `none` so a resumed session does not search again.

## Sharpen (whenever a term appears in the request, the evidence, or your own plan text)

- **Conflict with the glossary.** The user (or the code) uses a term in a way the glossary defines differently: "Your glossary defines `cancellation` as X, but this request reads as Y."
- **Fuzzy or overloaded term.** One word, several concepts ("account" = Customer or User?), or several words for one concept. Propose ONE canonical term and the words to avoid.
- **Code disagrees with the stated model.** The request says partial cancellation exists; the code only cancels whole Orders. Cite `path:line`.
- **Edge-case scenario.** When a relationship between concepts is part of the plan, probe its boundary with one concrete scenario before you plan against it.

How each path resolves these:

- **CLEAR** - term meaning is the user's domain, not a discoverable fact: a conflict or an overloaded term that changes what gets built is an owner-decision. Ask it with WHY, offer the canonical term you recommend FIRST, and a skipped question resolves to that recommendation. A pure naming preference with no behavior change is a default you record, not a question.
- **UNCLEAR** - do not interrogate. Adopt the glossary's term when one exists; otherwise adopt the clearest canonical term the code and the request support. Record each one in the Open-assumptions ledger AND the Domain language ledger with status `proposed`, so it surfaces in the human TL;DR for veto.

Use the resolved vocabulary everywhere downstream: todo titles, What-to-do text, Must-NOT-Have, QA scenario names, and any identifier the plan tells the executor to create. A plan that names a concept two ways is a self-review failure.

## Ledger (in `.omo/drafts/<slug>.md`, section `## Domain language`)

```
Sources: <GLOSSARY-MAP.md / GLOSSARY.md path(s) read, or none> | ADRs: <paths read, or none>
Context: <glossary file the new terms belong to>

Terms:
- **<Term>** | <one or two sentences: what it IS> | Avoid: <synonyms> | status: existing|new|changed|proposed | source: <user turn / path:line>

ADR candidates:
- <short title> | <1-3 sentences: context, decision, why> | reversible? no | surprising? yes | real trade-off? <the alternative rejected>
```

Write terms as they resolve; do not batch them at the end. Only `new`, `changed`, and `proposed` terms (and ADR candidates) produce file writes; `existing` rows are vocabulary the plan must use.

## What belongs where

**Glossary terms** - only concepts specific to this project's domain. General programming concepts (timeouts, retries, error types, caches) never go in, even if the code uses them heavily. Definitions say what the thing IS, in one or two sentences, with no implementation details: no file paths, class names, tables, or code. The glossary is not a spec and not a scratch pad.

**ADRs** - only when ALL three hold, otherwise skip:

1. **Hard to reverse** - changing your mind later has a meaningful cost.
2. **Surprising without context** - a future reader will wonder why it was done this way.
3. **A real trade-off** - genuine alternatives existed and one was picked for specific reasons.

Typical qualifiers: architectural shape, integration patterns between contexts, technology choices with lock-in, ownership and boundary decisions (the explicit no-s too), deliberate deviations from the obvious path, constraints invisible in the code (compliance, partner contracts), non-obvious rejected alternatives. An easily reversible or unsurprising choice stays in the draft's Decisions section only.

## Hand-off through the plan

In the plan, `## Scope` carries a `### Domain language` block (the scaffold emits it): the terms the plan relies on, each marked existing/new/changed, plus the ADRs to write. Every todo uses those terms.

When the ledger has at least one `new`, `changed`, or `proposed` term, or at least one ADR candidate, the plan MUST include a todo in Wave 1 (no dependencies; other todos may depend on it when they name the new terms) that writes them. Recommended task executor category: `writing`. Its What-to-do carries the literal entries from the ledger, so the executor has no interview context to recover:

- Glossary: edit the context's `GLOSSARY.md`; create it at the repo root when none exists (lazy creation; never create an empty glossary). Add or update only the ledger's terms; keep existing entries; group under subheadings only where clusters already exist or naturally form.
- ADRs: create `docs/adr/` lazily; number each new file by scanning the directory for the highest `NNNN` and incrementing (`0001-<slug>.md` when empty). A superseded ADR gets a `Status: superseded by ADR-NNNN` line, never a deletion.
- Acceptance criteria (agent-executable): every ledger term appears as a `**<Term>**:` entry in the target glossary; every ADR candidate exists as a numbered file; `git diff` touches no other product file in this todo.

When the ledger has nothing to write, there is no such todo; say `Domain language: no glossary or ADR changes` in the block.

### GLOSSARY.md format

```md
# <Context name>

<One or two sentences: what this context is and why it exists.>

## Language

**Order**:
A customer's request to buy one or more items, from placement until fulfilment or cancellation.
_Avoid_: Purchase, transaction

**Customer**:
A person or organization that places Orders.
_Avoid_: Client, buyer, account
```

Be opinionated: when several words name one concept, pick one and list the rest under `_Avoid_`.

A multi-context repo keeps a root `GLOSSARY-MAP.md` listing each context (link + one line) and how contexts relate (which events or shared types cross between them). Do not introduce a map for a single-context repo.

### ADR format

```md
# <Short title of the decision>

<1-3 sentences: the context, what was decided, and why.>
```

That is enough; an ADR may be one paragraph. Add `Status` (`proposed | accepted | deprecated | superseded by ADR-NNNN`), `Considered options`, or `Consequences` sections only when they carry information a future reader needs.

_Adapted from the domain-modeling skill in mattpocock/skills (MIT)._
