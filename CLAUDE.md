# CLAUDE.md

Guardrails, workflow, and standards for **frontend development**. This is a harness, not an application — it defines _how_ to build, not a specific app. It is the sibling of `python-harness` (backend), translated to the React/TypeScript ecosystem.

This file is loaded every session. It is the source of truth. Detailed standards live in `docs/architecture.md` (load on demand via `/arch`).

## Stack (fixed — changing it requires updating this file + docs/architecture.md first)

| Concern                   | Choice                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| Runtime / package manager | Node 22 LTS + **pnpm**                                                        |
| Framework / build         | **React 19 + Vite** (SPA)                                                     |
| Language / types          | **TypeScript strict** (`tsc --noEmit`)                                        |
| Boundary validation       | **Zod** (API responses, forms)                                                |
| REST server-state         | **TanStack Query** + `src/core/http.ts` fetch wrapper                         |
| GraphQL server-state      | **Apollo Client** (`src/core/apolloClient.ts`)                                |
| Styling                   | **Tailwind CSS**                                                              |
| Routing                   | React Router                                                                  |
| Lint / format             | **ESLint** (flat config) / **Prettier**                                       |
| Unit / component tests    | **Vitest + Testing Library + jsdom + MSW** (offline)                          |
| E2E tests                 | **Playwright** (scripted specs in `e2e/`) + **Playwright MCP** (agent-driven) |
| AI features               | `@anthropic-ai/sdk`, model `claude-opus-4-8` (server-side only)               |
| Perf / CI                 | Lighthouse CI, GitHub Actions (Linux + Windows)                               |

## Quick commands

| Slash        | Raw                                                | Purpose                                               |
| ------------ | -------------------------------------------------- | ----------------------------------------------------- |
| `/run`       | `pnpm dev`                                         | Start the Vite dev server (http://localhost:5173)     |
| `/lint`      | `pnpm lint && pnpm format:check && pnpm typecheck` | Lint + format-check + type-check                      |
| `/test`      | `pnpm test` (`pnpm test:e2e` for E2E)              | Run Vitest (and Playwright)                           |
| `/arch`      | —                                                  | Load & summarize `docs/architecture.md`               |
| `/plan`      | —                                                  | Research → design → write plan → user sign-off → STOP |
| `/implement` | —                                                  | Read plan → build → verify → auto-PR                  |
| `/review`    | —                                                  | Standards-adherence review (inline PR comments)       |
| `/context`   | —                                                  | Context/memory hygiene audit                          |
| `/retro`     | —                                                  | Capture lessons from friction into memory             |
| build        | `pnpm build`                                       | Type-check + production build to `dist/`              |
| perf         | `pnpm lhci`                                        | Lighthouse CI against built `dist/`                   |

## Development workflow loop

1. **Understand / research** — read the relevant code; `/arch` for standards.
2. **Plan** — for non-trivial work use `/plan`, get explicit user sign-off, then **STOP** before implementing.
3. **Implement** — code in the right feature slice and the right layer within it (UI → service → repository → core), explicit types, Tailwind for styling. New cross-feature reuse goes through a feature's `index.ts` or gets promoted to `core` deliberately.
4. **Sync** — `pnpm install` if dependencies changed.
5. **Verify** — `/lint` → `/test` → `/review`.
6. **Commit / PR** — feature branches are fine; committing to `main` requires an explicit user request.
7. **Improve** — capture non-obvious friction via `/retro`.

## Definition of Done (ALL must pass)

- `pnpm lint` clean
- `pnpm format:check` clean
- `pnpm typecheck` clean (no `any`, no implicit returns)
- `pnpm test` green (+ `pnpm test:e2e` when UI behavior changed)
- `/review` passes the standards in `docs/architecture.md`
- No secrets committed; no stray `console.*` (use `src/core/logger.ts`)
- New behavior has tests
- Non-obvious friction captured via `/retro`

## Guardrails

- **Explicit image-input consent (HARD RULE).** Before initiating ANY task in the session that would feed an image into the model — taking or attaching a screenshot (including via Playwright MCP `browser_take_screenshot`), pasting a design mockup, reading a diagram or a PDF page as an image, or any other visual input — **STOP and explicitly ask the user for permission first, and do not proceed until they confirm.** This applies even mid-task. The likely paths are `/run` and `/review` (visual verification) — those command docs repeat this rule.
- **Approved stack is fixed.** Introducing a different framework/library requires updating this file + `docs/architecture.md` first (see Dependency policy in architecture.md).
- **Secrets never reach the browser.** Only `VITE_`-prefixed env vars are bundled (treat as public). API keys (`ANTHROPIC_API_KEY`, `GH_TOKEN`) are server/build-side only.

## Two-terminal plan → implement workflow (cross-model handoff)

- **Terminal 1 (`/plan`, planning model):** research → pick base branch → locate or define the feature slice → design within it (UI → Service → Repository → core, choose design pattern) → write `.claude/plans/plan.md` + `.claude/plans/test-plan.md` → get explicit user sign-off → **STOP. Do NOT implement.**
- **Terminal 2 (`/implement`, implementation model):** read both plans → build task list → implement per layer → `/lint` → `/test` → `/review` → update plans append-only (record divergences under `## Deviations`) → auto-PR via `gh` (never directly to `main`).

Material deviations (changed approach, public signature, layer boundary, scope, or an open question) → STOP and re-confirm with the user. Immaterial ones (helper names, file splits, fixing pseudocode bugs) → proceed and log under Deviations.

## Context & memory management

- **CLAUDE.md** — always loaded; standards + workflow.
- **docs/architecture.md** — detailed standards; load on demand via `/arch`.
- **`~/.claude/projects/<slug>/memory/`** — durable facts outside the code; `MEMORY.md` is the index. `/retro` writes lessons here so they don't recur.
- Don't re-read files you just edited — trust file state. Keep context lean.

## Agent / subagent guidance

- Spawn subagents only when the user asks or for read-heavy fan-out search. Use `Explore`/`general-purpose` for search, `Plan` for design. Subagents return summaries; keep the main context lean.

## Model guidance (for any AI features built with this harness)

- Default model `claude-opus-4-8`; downgrade to `claude-sonnet-4-6` for routine work. Configure via env (`ANTHROPIC_MODEL`), read once in server-side config.
- **All Anthropic calls run server-side** — never ship `ANTHROPIC_API_KEY` to the browser.
- No `temperature`/`top_p`/`top_k`; use adaptive thinking for complex reasoning. Prompt-cache static system prompts. Stream long outputs (see § Streamed responses in architecture.md).

## Playwright MCP

The `@playwright/mcp` server is registered in `.mcp.json`, letting the agent drive a real browser (navigate, click, read the accessibility snapshot, assert) during `/run` and `/review` — the interactive complement to the scripted `e2e/` specs. **Taking a screenshot via MCP is an image input → requires explicit user consent first (see Guardrails).** Prefer the accessibility-tree snapshot (text) over screenshots, which needs no consent.

## Windows / PowerShell notes

- The primary shell is PowerShell; a Bash tool is also available for POSIX scripts.
- Run everything through `pnpm`. No `cd` prefix needed — the working directory is set.
- PowerShell has no `&&` chaining: use `;` or `if ($?) { ... }`. Env vars: `$env:VAR`.
