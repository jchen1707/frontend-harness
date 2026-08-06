# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase.

## Before exploring, read these

- **`docs/architecture.md`** — **the decision record for this repo.** Its §0 "Choosing
  architecture & design patterns per feature" records the architectural style and design
  patterns chosen per feature slice, and the rest is the authoritative standards reference
  (`/arch` loads it). Read it before proposing structural change; treat its recorded choices
  exactly as you would an ADR.
- **`CLAUDE.md`** — the always-loaded summary: approved stack, the dependency rule, Definition
  of Done. Where it and a skill's generic advice disagree, `CLAUDE.md` wins.
- **The nested `CLAUDE.md` for the directory you are changing** — `src/core/`,
  `src/components/`, `src/features/`, `e2e/`. These are path-scoped: working in `src/core/`
  does not load `src/features/CLAUDE.md`.
- **`CONTEXT.md`** at the repo root — the domain glossary, if it exists.
- **`docs/adr/`** — individual ADRs, if any exist. This repo has none yet: architectural
  decisions have been recorded in `docs/architecture.md` instead. A per-decision file under
  `docs/adr/` is fine for a decision too narrow to belong in the standards doc, but don't
  migrate the existing record — keep `docs/architecture.md` authoritative.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't
suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs`
and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get
resolved.

## File structure

Single-context repo (this repo):

```
/
├── CLAUDE.md                  ← standards summary, always loaded
├── CONTEXT.md                 ← domain glossary (not yet created)
├── docs/
│   ├── architecture.md        ← standards + the architectural decision record
│   ├── adr/                   ← optional per-decision files (none yet)
│   └── agents/                ← this file, issue-tracker.md, triage-labels.md
├── src/
│   ├── features/<slice>/      ← ui/ · services/ · repositories/ · index.ts
│   ├── components/ui/         ← shared presentational primitives
│   ├── core/                  ← http, clients, logger, errors
│   └── env.ts                 ← the only reader of import.meta.env
└── e2e/                       ← Playwright specs
```

Multi-context layout (a root `CONTEXT-MAP.md` pointing at per-context `CONTEXT.md` files) does
not apply here — this is a single Vite application, not a monorepo.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis,
a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary
explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/domain-modeling`).

Note the standing ambiguities this repo has already resolved:

- **"agent" means a Claude Code dev-workflow subagent** (`.claude/agents/`), not an
  application-level AI agent. Say which you mean.
- **"component" means a React component**; a "feature" means a slice under `src/features/`.
  Do not call a slice a module.
- **"service" means the hook layer inside a slice** (`services/`), not a backend service.

## Flag ADR conflicts

If your output contradicts a decision recorded in `docs/architecture.md` (or an ADR under
`docs/adr/`), surface it explicitly rather than silently overriding:

> _Contradicts docs/architecture.md §1 (the fractal dependency rule) — but worth reopening
> because…_

The fractal dependency rule (`ui` → `services` → `repositories` → `core` within a slice,
cross-slice only through `index.ts`) and the approved stack are the two most likely to be
contradicted by generic advice. Neither changes without a `CLAUDE.md` edit first.
