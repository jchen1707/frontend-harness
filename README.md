# frontend-harness

Guardrails, workflow, and standards for frontend (React/TypeScript) development — **a
harness, not an application.** It defines how to build here (workflow, gates, architectural
standards, context/memory management) and leaves the product code for you to write per those
standards. It is the frontend sibling of [`python-harness`](https://github.com/jchen1707/python-harness).

Target workload: React 19 SPA, REST and GraphQL clients, AI features served from a backend
(Vite · TypeScript strict · Zod · TanStack Query · Apollo · Tailwind · Vitest · Playwright).

The repo ships a minimal, runnable skeleton (a health route + its tests) so development and
verification work out of the box.

## What's here

- `AGENTS.md` — the harness-neutral source of truth: stack, workflow, Definition of Done,
  and context guidance. Codex and other compatible agents load it directly.
- `docs/architecture.md` — **cross-cutting** standards only: the dependency rule, interfaces,
  data fetching, config, types, styling, accessibility, performance, testing, dependency
  policy (load with `/arch`).
- `package.json` — tool config and the approved stack.
<!-- harness:agnostic -->
- `.agents/skills/` — canonical repo-owned skills, including a complete delivery fallback
  that requires no external plugin.
- `.claude/` — Claude Code adapters, optional plugins, hooks, agents, and its dynamic review
  runner. These improve Claude Code use but do not define the repository contract.
- `CLAUDE.md` and nested copies — thin pointers to the matching `AGENTS.md` files.
- `docs/harness-compatibility.md` — capability mapping for skills, tools, agents, loops,
  workflows, and plugins.
  <!-- /harness:agnostic -->
  <!-- harness:claude
- `.claude/` — shared Claude Code config: `settings.json` (pre-approved commands, hooks,
  plugins), `commands/`, `skills/`, `agents/`, `workflows/`, `hooks/`. `.claude/skills/`
  holds repo-owned skills, including a complete delivery fallback that needs no plugin.
  /harness:claude -->
- `docs/agents/` — how agents work with **this** repo: `issue-tracker.md` (the team and
branch prefix), `triage-labels.md`, `domain.md`. Each states only what is true here and
points at the shared doctrine.
<!-- harness:agnostic -->
- `.agents/vendor/harness/` — the stack-neutral half of the harness, generated from
  [`harness`](https://github.com/jchen1707/harness) and pinned by sha. **Never edit it
  here**; edit it there and re-run the sync. CI fails when this copy is hand-edited or the
  pin falls behind.
  <!-- /harness:agnostic -->
  <!-- harness:claude
- The stack-neutral half of the harness arrives as the `harness` plugin, resolved outside
  the repo through `${CLAUDE_PLUGIN_ROOT}` — so it is present in every worktree, which a
  submodule would not be.
  /harness:claude -->
- `.out-of-scope/` — rejected feature requests, read by `/triage` to avoid re-litigating a
  decision that was already made.
- `.github/workflows/ci.yml` — CI gates on Linux and Windows.
- `.husky/pre-commit` + `lint-staged` — format and fix staged files at commit time.
- `src/` — the skeleton. Each directory carries its own `AGENTS.md` with the conventions that
  govern it (see below).

## Layout — rules live next to the code

Each directory owns its conventions. Read the root file and every nested `AGENTS.md` that
applies to the path you change.

```
src/
├── features/<name>/      one vertical slice, top to bottom
│   ├── ui/               routes and components — presentation only
│   ├── services/         hooks: business logic, TanStack Query / Apollo
│   ├── repositories/     transport behind an interface
│   │   └── schemas/      Zod validation for every response shape
│   └── index.ts          the slice's PUBLIC SURFACE
├── components/ui/        design-system primitives
├── core/                 http, errors, logger, queryClient, apolloClient
├── env.ts                the only reader of import.meta.env
├── test/                 MSW handlers and shared setup
└── App.tsx main.tsx      composition root
e2e/                      Playwright specs
```

Dependency direction, one way, **inside** a slice:

```
ui  ──▶  services  ──▶  repositories  ──▶  core / env
```

Across slices: only through the other slice's `index.ts`. `core/` and `components/` are
cross-cutting — every slice may import them, they import nothing above. **This is
machine-enforced** by `eslint-plugin-boundaries`, so an illegal import fails `pnpm lint`.

**These files are path-scoped.** Working in `src/core/` does not load
`src/features/AGENTS.md`. That is why anything spanning layers stays in
`docs/architecture.md` — a cross-layer rule in a leaf file stops being enforced exactly where
it matters. Root `AGENTS.md` indexes both, and carries a reference table mapping a task to the
file to read before starting it.

## Setup

Requires **Node 22** and **pnpm** (`corepack enable` provides the pinned version).

```sh
pnpm install                              # also installs the husky hooks
cp .env.example .env                      # optional: the skeleton runs on defaults
pnpm dev                                  # http://localhost:5173
pnpm exec playwright install chromium     # once, before the first pnpm test:e2e
```

### Browser work — two tools, two jobs

They are not alternatives, and picking the wrong one is the common mistake:

|                    | Tool                        | Job                                                                                                   |
| ------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Fast loop**      | `chrome-devtools` MCP       | Agent-driven: build, iterate on design, debug, profile. Needs Chrome installed; no setup beyond that. |
| **Regression net** | `@playwright/test` → `e2e/` | Scripted specs with assertions, retries and CI. `pnpm test:e2e`.                                      |

Chrome DevTools MCP has **no runner, no assertions and no CI integration** — nothing it does
can fail a build. It is for exploring and diagnosing, and it is fast at that: a text a11y
snapshot (`take_snapshot`), console and network inspection, and real Core Web Vitals traces
(`performance_start_trace`). Playwright is what still checks your work in six months.

**The workflow is explore → promote.** Drive the browser to settle the behaviour, then write
it into `e2e/` as a spec.

The committed config runs `--headless --isolated`, so the agent gets a throwaway Chrome
profile rather than your real one, plus `--redact-network-headers`, `--no-usage-statistics`
and `--no-performance-crux` so credentials, usage data and traced URLs stay on the machine.

### Symbol navigation (optional)

Use the harness's TypeScript LSP integration when it has one. Fall back to `rg` plus manual
definition and import inspection when it does not. Claude Code setup is:

```sh
npm install -g typescript-language-server
claude plugin install typescript-lsp@claude-plugins-official
```

Then restart. LSP servers load at session start, like MCP servers.

**A clone does not inherit this.** `.claude/settings.json` lists the plugin under
`enabledPlugins`, but that only _enables_ an already-installed plugin — it does not fetch one,
so the `claude plugin install` line above is not optional. Confirm with
`claude plugin details typescript-lsp@claude-plugins-official`, which should report
`LSP servers (1) typescript`.

It runs out of process and costs **no tokens per session**. When to prefer it over grep, and
the two position gotchas that waste a call: `AGENTS.md` → Symbol navigation.

### Linear (optional, once per machine)

Authenticate Linear in Docker Desktop MCP Toolkit. Enable Linear for the active profile.
Select the **Development** workspace. Restart the active harness, then check `/mcp` for the
Toolkit gateway and its Linear tools.

<!-- harness:agnostic -->

Codex must trust the project before it reads `.codex/config.toml`.

<!-- /harness:agnostic -->

### Second brain (optional)

Set `OBSIDIAN_VAULT_DIRECTORY` in your **user** settings. Do not set it in this repo's
committed `.claude/settings.json`. The SessionEnd hook writes dated notes to the vault's
`Project Learnings` directory.

**This harness writes notes; it does not index them.** `python-harness` owns
`_VAULT_INDEX.md` and `Project Learnings/_INDEX.md` and rebuilds both when a session ends
there — one indexer, so there is no second copy to drift. The trade is that notes written
here do not appear in either index until you next end a session in `python-harness`;
`/search-second-brain` greps the vault as well as reading the indexes to cover the gap.

## The SDLC

How a request travels from landing in the tracker to meeting the Definition of Done.
`AGENTS.md` is the authority. Skill and command names are adapters for these stages.

```
   Linear issue
        │
        ▼
   triage ──┬─▶ needs-triage ⇄ needs-info      evaluation loop, not terminal
            │
            ├─▶ ready-for-human · wontfix      leaves the pipeline
            │
            └─▶ ready-for-agent
                     │
                     ▼
   ┌── ALIGNMENT — one unbroken context ───────────────────────────────────────┐
   │ discover → clarify → /improve-codebase-architecture (if needed)           │
   │ → /codebase-design (if interface/seam needs design)                       │
   │ → specify → split                                                         │
   └───────────────────────────────────────────────────────────────────────────┘
                     │ one ticket at a time
                     ▼
   ┌── EXECUTION — branch first, fresh context per ticket ─────────────────────┐
   │ implement → /tdd (behavior change) → verify → Standards + Spec review     │
   └───────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
              PR → Definition of Done
```

### Where the Matt Pocock skills fit

These skills add optional steps to the main path. Do not run all three for every ticket.

| Skill                            | Place it                                                                                    | Use it when                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/improve-codebase-architecture` | During alignment, after discovery or clarification and before specification                 | The change exposes architectural friction, shallow modules, or hard-to-test code. It scans the codebase and gives you candidates to choose from. |
| `/codebase-design`               | During alignment, after you choose a candidate and before specification confirms the seams  | The module, interface, or seam needs design. Use its deep-module vocabulary to reduce the interface and hide more behavior behind it.            |
| `/tdd`                           | During execution, inside implementation, after specification or planning confirms the seams | The ticket adds or changes behavior. Run one red → green cycle per vertical slice, then refactor during review.                                  |

For architecture work, use this order:

```
discover → clarify → /improve-codebase-architecture → /codebase-design
→ specify → split → implement → /tdd → verify → review
```

Skip the two architecture skills when the design is already clear. For small work, run `/tdd`
inside implementation after plan sign-off. Skip `/tdd` for documentation-only or configuration-only
changes.

Small work can start at clarify or implement. The delivery skill records state in
`.agents/plans/`, so a new agent or harness can resume it.

## Commands

| Command                             | What it does                             |
| ----------------------------------- | ---------------------------------------- |
| `pnpm dev`                          | Start the Vite dev server                |
| `pnpm build`                        | Type-check + production build to `dist/` |
| `pnpm preview`                      | Serve the built `dist/`                  |
| `pnpm lint`                         | ESLint, incl. the dependency rule        |
| `pnpm format` / `pnpm format:check` | Prettier write / check                   |
| `pnpm typecheck`                    | `tsc --noEmit` (strict)                  |
| `pnpm test` / `pnpm test:watch`     | Vitest (offline unit/component)          |
| `pnpm test:e2e`                     | Playwright E2E (boots the dev server)    |
| `pnpm lhci`                         | Lighthouse CI against built `dist/`      |

The canonical skills live in `.agents/skills/`. Start with `delivery` for end-to-end work,
`verify` for gates, and `loop-goal` for standing work. A harness can expose these as skills,
commands, or direct instructions. Claude Code adapters live in `.claude/`.

Matt Pocock's skills plugin remains enabled for Claude Code and may implement matching
delivery stages. Codex and other harnesses use the repository fallback when that plugin is
not available. Both paths produce the same plans, tests, review evidence, and PR shape.

## What runs without being asked

| Hook                                 | Effect                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `protect_paths.mjs` (PreToolUse)     | Blocks edits to `.env`, `pnpm-lock.yaml`, `dist/`, generated output                               |
| `format_edited.mjs` (PostToolUse)    | Prettier on each edited file; ESLint `--fix` on `.ts`/`.tsx`                                      |
| `verify.mjs` (Stop)                  | Blocks the turn while the gates fail, when the turn touched gated source                          |
| `session_learnings.mjs` (SessionEnd) | Writes the session's lessons to the second brain (notes only — `python-harness` owns the indexes) |

Claude Code's Stop gate makes its sessions walk-away-able. `HARNESS_SKIP_VERIFY=1` disables
that adapter for a session; `CLAUDE_SKIP_VERIFY` remains as a legacy alias. Other harnesses
rely on the verify skill, Git hooks, and CI.

## Conventions

- **Feature-sliced, fractal layering** — see above; machine-enforced.
- **Validated boundaries** — every external response is parsed through a Zod schema before it
  enters the app. Never `as`.
- **Interfaces over implementations** — a repository is an interface with an `Http*` and a
  `Fake*`; services take it as an option with a production default, so tests run offline.
- **Strict types** — `any` is an ESLint error; exported functions carry explicit types.
- **Offline tests** — MSW intercepts every request with `onUnhandledRequest: 'error'`.
- **The approved stack is fixed in `package.json`** — adding a different framework requires
  updating [AGENTS.md](AGENTS.md) + [docs/architecture.md](docs/architecture.md) first.

See [`docs/architecture.md`](docs/architecture.md) for the full standards (data fetching,
SSR/SSG/SEO, performance, testing, design-pattern selection).
