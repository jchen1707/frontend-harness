# frontend-development-harness

Guardrails, workflow, and standards for frontend (React/TypeScript) development — **a
harness, not an application.** It defines how to build here (workflow, gates, architectural
standards, context/memory management) and leaves the product code for you to write per those
standards. It is the frontend sibling of [`python-harness`](https://github.com/jchen1707/python-harness).

Target workload: React 19 SPA, REST and GraphQL clients, AI features served from a backend
(Vite · TypeScript strict · Zod · TanStack Query · Apollo · Tailwind · Vitest · Playwright).

The repo ships a minimal, runnable skeleton (a health route + its tests) so `/run` and
`/verify` work out of the box.

## What's here

- `CLAUDE.md` — the source of truth: stack, workflow, Definition of Done, what the hooks
  enforce, context/memory guidance. Loaded every Claude Code session.
- `docs/architecture.md` — **cross-cutting** standards only: the dependency rule, interfaces,
  data fetching, config, types, styling, accessibility, performance, testing, dependency
  policy (load with `/arch`).
- `package.json` — tool config and the approved stack.
- `.claude/` — shared Claude Code config: `settings.json` (pre-approved commands, hooks,
  plugin), `commands/`, `skills/`, `agents/`, `workflows/`, `hooks/`.
- `.claude/settings.json` → `enabledPlugins` — declares the `mattpocock-skills` plugin, so a
  clone picks it up automatically and it self-updates. `.claude/skills/` holds repo-owned
  skills only.
- `docs/agents/` — how agents work with this repo: `issue-tracker.md` (Linear conventions),
  `triage-labels.md` (canonical triage roles → real label strings), `domain.md`.
- `.out-of-scope/` — rejected feature requests, read by `/triage` to avoid re-litigating a
  decision that was already made.
- `.github/workflows/ci.yml` — CI gates on Linux and Windows.
- `.husky/pre-commit` + `lint-staged` — format and fix staged files at commit time.
- `src/` — the skeleton. Each directory carries its own `CLAUDE.md` with the conventions that
  govern it (see below).

## Layout — rules live next to the code

Each directory owns its conventions. Read the file for the directory you are changing; Claude
Code loads it automatically when working there.

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
`src/features/CLAUDE.md`. That is why anything spanning layers stays in
`docs/architecture.md` — a cross-layer rule in a leaf file stops being enforced exactly where
it matters. Root `CLAUDE.md` indexes both, and carries a reference table mapping a task to the
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

|                    | Tool                                | Job                                                                                                   |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Fast loop**      | `chrome-devtools` MCP (`.mcp.json`) | Agent-driven: build, iterate on design, debug, profile. Needs Chrome installed; no setup beyond that. |
| **Regression net** | `@playwright/test` → `e2e/`         | Scripted specs with assertions, retries and CI. `pnpm test:e2e`.                                      |

Chrome DevTools MCP has **no runner, no assertions and no CI integration** — nothing it does
can fail a build. It is for exploring and diagnosing, and it is fast at that: a text a11y
snapshot (`take_snapshot`), console and network inspection, and real Core Web Vitals traces
(`performance_start_trace`). Playwright is what still checks your work in six months.

**The workflow is explore → promote.** Drive the browser to settle the behaviour, then write
it into `e2e/` as a spec.

The committed config runs `--headless --isolated`, so the agent gets a throwaway Chrome
profile rather than your real one, plus `--redact-network-headers`, `--no-usage-statistics`
and `--no-performance-crux` so credentials, usage data and traced URLs stay on the machine.

### Symbol navigation (once per machine)

Agents resolve TypeScript **symbols** — definitions, references, types — through Claude
Code's built-in `LSP` tool instead of grepping for text. Two steps, both one-off:

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
the two position gotchas that waste a call: `CLAUDE.md` → Symbol navigation.

### Linear (optional, once per machine)

`.mcp.json` declares Linear as a remote server whose `Authorization` header comes from
`.claude/mcp-headers.mjs`, which reads the OS credential store. Create a personal API key at
**Linear → Settings → Security & access → Personal API keys**, in the workspace this repo
should use, then store it once — in a real terminal, so the value never reaches an agent:

```powershell
$dir = Join-Path $env:USERPROFILE '.claude\mcp-credentials'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
(Read-Host -AsSecureString 'Paste the Linear key') |
  ConvertFrom-SecureString | Set-Content (Join-Path $dir 'linear-fro.cred')
```

Restart Claude Code, then check `/mcp`. **Set no environment variable.** The Bash tool
inherits Claude Code's environment, so a `LINEAR_API_KEY` variable can be printed into a
transcript by one careless command — and a key in a transcript has to be rotated. See
`docs/secrets.md` for the full reasoning, the macOS and Linux equivalents, and rotation.

A personal API key belongs to one workspace, which is the point: it binds this repo to that
workspace, where the claude.ai account connector would bind your whole account and move every
project at once. If you were using the connector, disconnect it once this works, or two
Linear tool surfaces show up and neither says which workspace a write reached.

### Second brain (optional)

Set `CLAUDE_LEARNINGS_DIR` in your **user** settings — never in this repo's committed
`.claude/settings.json`, or a clone inherits a path to your vault. With it set, the SessionEnd
hook distils each session's hard-won lessons into a dated note.

**This harness writes notes; it does not index them.** `python-harness` owns
`_VAULT_INDEX.md` and `Project Learnings/_INDEX.md` and rebuilds both when a session ends
there — one indexer, so there is no second copy to drift. The trade is that notes written
here do not appear in either index until you next end a session in `python-harness`;
`/search-second-brain` greps the vault as well as reading the indexes to cover the gap.

## The SDLC

How a request travels from landing in the tracker to meeting the Definition of Done.
`CLAUDE.md` is the authority; this is the map.

```
   Linear issue
        │
        ▼
   /triage ─┬─▶ needs-triage ⇄ needs-info      evaluation loop, not terminal
            │
            ├─▶ ready-for-human · wontfix      leaves the pipeline
            │
            └─▶ ready-for-agent
                     │
                     ▼
   ┌── ALIGNMENT — one unbroken context ──────────────┐
   │  /grill-with-docs → /to-spec → /to-tickets       │
   └──────────────────────────────────────────────────┘
                     │ one ticket at a time
                     ▼
   ┌── EXECUTION — branch first, fresh context per ticket ─┐
   │  /plan → sign-off → /implement-from-plan              │
   │                       → /verify → /code-review        │
   └───────────────────────────────────────────────────────┘
                     │
                     ▼
              PR → Definition of Done
```

Small work skips alignment: `/plan` in one terminal, `/implement-from-plan` in another.

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

Slash commands come from three places, and the session's skill listing shows all of them:

- **`.claude/commands/`** — repo-owned: `/plan`, `/implement-from-plan`, `/arch`, `/lint`,
  `/test`, `/run`, `/context`, `/retro`.
- **`.claude/skills/`** — repo-owned skills: `/verify`, `/loop-goal`, `/prune-rules`,
  `/search-second-brain`.
- **`mattpocock-skills` plugin** — `/triage`, `/grill-with-docs`, `/to-spec`, `/to-tickets`,
  `/implement`, `/tdd`, `/code-review`, `/wayfinder` and the rest. Declared in
  `.claude/settings.json`; never vendored into the repo.

## What runs without being asked

| Hook                                 | Effect                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `protect_paths.mjs` (PreToolUse)     | Blocks edits to `.env`, `pnpm-lock.yaml`, `dist/`, generated output                               |
| `format_edited.mjs` (PostToolUse)    | Prettier on each edited file; ESLint `--fix` on `.ts`/`.tsx`                                      |
| `verify.mjs` (Stop)                  | Blocks the turn while the gates fail, when the turn touched gated source                          |
| `session_learnings.mjs` (SessionEnd) | Writes the session's lessons to the second brain (notes only — `python-harness` owns the indexes) |

The Stop gate is what makes a session walk-away-able. `CLAUDE_SKIP_VERIFY=1` disables it for a
session.

## Conventions

- **Feature-sliced, fractal layering** — see above; machine-enforced.
- **Validated boundaries** — every external response is parsed through a Zod schema before it
  enters the app. Never `as`.
- **Interfaces over implementations** — a repository is an interface with an `Http*` and a
  `Fake*`; services take it as an option with a production default, so tests run offline.
- **Strict types** — `any` is an ESLint error; exported functions carry explicit types.
- **Offline tests** — MSW intercepts every request with `onUnhandledRequest: 'error'`.
- **The approved stack is fixed in `package.json`** — adding a different framework requires
  updating [CLAUDE.md](CLAUDE.md) + [docs/architecture.md](docs/architecture.md) first.

See [`docs/architecture.md`](docs/architecture.md) for the full standards (data fetching,
SSR/SSG/SEO, performance, testing, design-pattern selection).
