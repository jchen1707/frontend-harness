# frontend-development-harness

A **harness, not an application**: guardrails, workflow, and standards for frontend (React/TypeScript) development. It defines _how_ to build — layering, tooling gates, slash commands, and an agent workflow — not a specific product. It is the frontend sibling of `python-harness`.

The repo ships a minimal, runnable skeleton (a health/smoke route + tests) so `/run` and `/test` work out of the box. Build real features on top of the layers documented in [`docs/architecture.md`](docs/architecture.md).

## Setup

Requires **Node 22** and **pnpm** (`corepack enable` will provide the pinned pnpm).

```bash
pnpm install
cp .env.example .env   # optional: skeleton runs with built-in defaults
pnpm dev               # http://localhost:5173
```

Enable git hooks (once): `pnpm install` runs `husky` via the `prepare` script.

## Commands

| Command                             | What it does                             |
| ----------------------------------- | ---------------------------------------- |
| `pnpm dev`                          | Start the Vite dev server                |
| `pnpm build`                        | Type-check + production build to `dist/` |
| `pnpm preview`                      | Serve the built `dist/`                  |
| `pnpm lint`                         | ESLint (type-aware, flat config)         |
| `pnpm format` / `pnpm format:check` | Prettier write / check                   |
| `pnpm typecheck`                    | `tsc --noEmit` (strict)                  |
| `pnpm test` / `pnpm test:watch`     | Vitest (offline unit/component)          |
| `pnpm test:e2e`                     | Playwright E2E (boots the dev server)    |
| `pnpm lhci`                         | Lighthouse CI against built `dist/`      |

Slash commands (`/plan`, `/implement`, `/lint`, `/test`, `/review`, `/arch`, `/run`, `/context`, `/retro`) are defined in `.claude/commands/` and described in [CLAUDE.md](CLAUDE.md).

## Conventions

- **Layered:** UI/routes → services (hooks) → repositories (data access behind interfaces) → core/env. No reverse/lateral dependencies.
- **Validated boundaries:** every external response is parsed through a Zod schema before it enters the app.
- **Strict types:** `any` is an ESLint error; exported functions carry explicit types.
- **The approved stack is fixed in `package.json`** — adding a different framework requires updating [CLAUDE.md](CLAUDE.md) + [docs/architecture.md](docs/architecture.md) first.

See [`docs/architecture.md`](docs/architecture.md) for the full standards (data fetching, SSR/SSG/SEO, performance, testing, design-pattern selection).
