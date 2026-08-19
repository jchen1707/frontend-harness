# Domain Docs — this repo

<!-- harness:agnostic -->

**Shared doctrine lives in `.agents/vendor/harness/docs/agents/domain.md`** — what to read
before exploring, the proceed-silently rule, the glossary-vocabulary rule and how to flag an
ADR conflict. It is vendored from [`harness`](https://github.com/jchen1707/harness) and
pinned by sha; read it first.

<!-- /harness:agnostic -->
<!-- harness:claude
**Shared doctrine is provided by the `harness` plugin**, at
`${CLAUDE_PLUGIN_ROOT}/docs/agents/domain.md` — what to read before exploring, the
proceed-silently rule, the glossary-vocabulary rule and how to flag an ADR conflict. Read it
first.
/harness:claude -->

This file records only what is true in **this** repo.

## File structure

```
/
├── AGENTS.md                  ← standards summary, always loaded
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

A single Vite application, not a monorepo — the multi-context `CONTEXT-MAP.md` layout does
not apply.

`docs/architecture.md` §0 "Choosing architecture & design patterns per feature" is the
per-slice decision record here.

## Nested `AGENTS.md`

Path-scoped, and they do not cascade: working in `src/core/` does not load
`src/features/AGENTS.md`. They live in `src/core/`, `src/components/`, `src/features/` and
`e2e/`. Read the one for the directory you are changing.

## Vocabulary this repo has settled

- **"agent" means a dev-workflow subagent** (`.claude/agents/`), not an application-level AI
  agent. Say which you mean.
- **"component" means a React component**; a **"feature"** means a slice under
  `src/features/`. Do not call a slice a module.
- **"service" means the hook layer inside a slice** (`services/`), not a backend service.

## The rule most likely to be contradicted

The fractal dependency rule — `ui` → `services` → `repositories` → `core` within a slice,
cross-slice only through `index.ts` — and the approved stack. Neither changes without an
`AGENTS.md` edit first.

> _Contradicts docs/architecture.md §1 (the fractal dependency rule) — but worth reopening
> because…_
