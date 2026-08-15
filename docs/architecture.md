# Architecture & Standards

Detailed standards for this harness. Read it before architectural work. `AGENTS.md` is the
always-loaded summary; this file is the reference. Changing the approved stack or a standard
means editing this file and `AGENTS.md` first.

---

## §0 Choosing architecture & design patterns per feature

**The unit of organization is the feature, not the layer.** Each feature owns its slice top-to-bottom under `src/features/<name>/` — its UI, its services (hooks), its repositories + schemas, and any feature-local types. The one-directional dependency rule (§1) holds _within_ the slice. The payoff: changes stay vertical (a typical edit touches one folder from route down to data access, not four global layer directories), and deleting a feature is deleting a folder, not archaeology across the tree.

Pick the **structural style of the feature** deliberately during planning, and document the choice:

- **Default: layered slice** — inside the feature, UI/routes → services (hooks) → repositories → core. Good for most features.
- **Flux / unidirectional** — for complex shared client state, a store (reducer/`useReducer` or a state library) with one-way data flow.
- **Event-driven** — for realtime (WebSocket/SSE) features, an emitter/subscription boundary in the repository layer feeding services.

Then choose the **React / GoF design pattern(s)** for the feature and justify them in the plan:

- **Custom hooks** — the primary unit of logic reuse (default for sharing behavior).
- **Container / presentational** — separate data-fetching from rendering when a view is reused or heavily tested.
- **Compound components** — for flexible, composable UI (`<Tabs>`/`<Tabs.Tab>`).
- **Provider / context** — for cross-cutting dependency injection (theme, auth, clients).
- **Render props / HOC** — only when hooks can't express the sharing.
- **Reducer** — for multi-field state with interdependent transitions.
- **Factory / Strategy** — for selecting repository implementations at composition time.
- **Adapter** — to wrap third-party API clients behind our repository interfaces.

The agent must state the chosen pattern and _why_ during planning.

---

## §1 The dependency rule — stated once, applies fractally

```
src/
  features/<name>/
    ui/            routes + components (presentation + transport)
    services/      hooks: business logic, TanStack Query / Apollo, orchestration
    repositories/  data access behind interfaces; schemas/ holds Zod boundary validation
    index.ts       the feature's PUBLIC SURFACE — the only thing other features may import
  core/            cross-cutting primitives: logger, errors, http, queryClient, apolloClient
  components/      design-system / shared UI primitives
  env.ts           the single place env is read + validated
  App.tsx main.tsx composition root / app shell (wires providers + routes feature surfaces)
```

The rule has two clauses:

1. **Within a feature** — `ui → services → repositories → core/env`, one direction. A UI component calls **one** service hook and shapes the view (no fetch/data access). Services hold business logic, derived state, and coordination, composing repositories. Repositories own transport + response validation behind **interfaces**. No reverse edges: a repository never imports a service or React; UI never imports a repository.
2. **Across features** — a feature may depend on another feature **only through its published surface** (`index.ts`), never its services, repositories, or internal components. Genuinely shared things live in `core/` (logic) and `components/` (design-system primitives): every feature may depend on them, and they depend on nothing above. **`core` is the only place horizontal sharing is legal, and it sits at the bottom of the graph.**

**This is machine-enforced** by `eslint-plugin-boundaries` (config in `eslint.config.js`). Illegal reverse, lateral, or cross-feature-internal imports fail `pnpm lint` — the rule an agent or new dev relies on is a guardrail, not a convention. The same statement applies at every scale, which is why a feature is locatable by name and an agent can trust that everything relevant is colocated.

**Keeping `core`/`components` honest (the one judgment call).** They are for genuinely cross-cutting primitives only — not a junk drawer. When two features keep reaching for the same thing, promote it to `core` **deliberately** rather than by accident, and don't let shared code swell into a second app. "What counts as a feature" is decided during planning; the failure mode to avoid is a junk-drawer feature.

---

## §2 Interfaces over implementations

Repositories define a TS `interface`; provide a production implementation (`Http*` / Apollo-backed) and a test implementation (`Fake*`), injected at composition time. Worked example: `src/features/health/repositories/health.ts` (`HealthRepository` + `HttpHealthRepository` + `FakeHealthRepository`). Services accept the interface with a production default (`useHealth({ repository })`), so tests inject a fake with zero network. This mirrors the Embedder/VectorStore pattern in `python-harness`.

---

## §3 Data fetching — REST & GraphQL

Validate **every** external response through a Zod schema at the repository boundary before it enters the app (`src/features/<name>/repositories/schemas/`).

**REST (TanStack Query + `core/http.ts`):**

- Stable, structured `queryKey`s; tune `staleTime`/`gcTime` per resource.
- Retry with backoff (configured on the client); disable for non-idempotent ops.
- Mutations via `useMutation`; optimistic updates with rollback on error; invalidate affected keys.
- Pagination/infinite queries via `useInfiniteQuery`.
- Cancellation: pass the query's `signal` through `core/http.ts` (already wired) so aborted/stale requests don't resolve.

**GraphQL (Apollo Client, `core/apolloClient.ts`):**

- **Typed operations** — generate types from the schema (graphql-codegen) rather than hand-typing.
- Use the normalized `InMemoryCache`; set `fetchPolicy` deliberately (`cache-first` default, `network-only` for must-be-fresh, `cache-and-network` for fast+fresh).
- Co-locate **fragments** with components; request only needed fields (avoid over-fetching).
- Consider query batching / persisted queries for chatty screens.
- Handle partial errors via `errorPolicy`; still validate critical payloads with Zod.

Pick REST **or** GraphQL per resource based on the backend; both flow through the repository layer and are validated identically.

---

## §4 Client state

Separate **server state** (TanStack Query / Apollo cache — fetched, cached, invalidated) from **client state** (UI-only: toggles, form drafts, selections). Reach for `useState`/`useReducer` + context first; introduce a store only when shared client state becomes genuinely cross-cutting. Never duplicate server data into client state.

---

## §5 Async & cancellation (the concurrency analog)

- `async`/`await` for all I/O; no floating promises (ESLint enforces).
- Use `AbortController`/`AbortSignal` to cancel in-flight work; `core/http.ts` already links an external signal + a timeout.
- Avoid race conditions: rely on query keys + signals so the last relevant response wins; clean up effects on unmount.

---

## §6 Config & env

`src/env.ts` is the **single** place env is read, validated with Zod. Only `VITE_`-prefixed vars are inlined into the browser bundle — treat them as **public**. Real secrets (`ANTHROPIC_API_KEY`, `GH_TOKEN`) stay server/build-side and must never be `VITE_`-prefixed. Never hardcode config; never read `import.meta.env` outside `env.ts`.

**Adding a key of any kind: `docs/secrets.md`.** It covers the three readers (browser, server, Claude Code itself), how to store a value without it reaching shell history or the transcript, and how to rotate one that leaked. The short version: a secret is compromised the moment its value enters a transcript, so `.env` is unreadable to the agent by hook, and keys Claude Code itself reads live in the OS credential store behind a `headersHelper` — never in an environment variable, which every child process inherits, and never in a `settings.json` `env` block, which an agent opens for unrelated edits.

---

## §7 SSR / SSG / SEO

Default is a **Vite SPA (CSR)**. When first-paint or SEO matters, choose during planning (and update AGENTS.md + this file before adopting):

1. **Pre-render / SSG** — static HTML per route via `vite-plugin-ssr`/`vike` or a prerender step. Best when content is mostly static.
2. **SSR** — a Node server entry rendering React to a stream. Best for dynamic, crawlable, fast-first-paint pages.
3. **Migrate to a meta-framework** (Next.js) — when SSR/routing/data needs outgrow the SPA. This is a stack change → requires updating AGENTS.md + this file.

**SEO baseline regardless of rendering:**

- Semantic HTML and a single `<h1>` per page.
- Per-route `<title>`, `<meta name="description">`, Open Graph/Twitter tags via a head manager.
- `robots.txt` + `sitemap.xml`; canonical URLs; `lang` attribute.
- Structured data (JSON-LD) where applicable.
- Images: dimensions set (avoid CLS), `loading="lazy"` below the fold, descriptive `alt`.

---

## §8 Logging & errors

- Log through `src/core/logger.ts` — the **only** sanctioned place for `console`. No stray `console.*` elsewhere (ESLint warns; Definition of Done forbids).
- Typed error hierarchy in `src/core/errors.ts` (`AppError` → `HttpError`/`ValidationError`).
- Wrap route subtrees in React error boundaries; never swallow errors silently. Repositories throw typed errors; services/UI decide how to surface them.

---

## §9 Types

- TypeScript **strict** plus `noUncheckedIndexedAccess`, `noImplicitReturns`, `exactOptionalPropertyTypes`, `noUnused*` (see `tsconfig.json`).
- `any` is an **ESLint error**; prefer `unknown` + narrowing. Exported functions carry explicit parameter and return types (`explicit-module-boundary-types`) — the analog of mypy `disallow_untyped_defs`.
- `verbatimModuleSyntax` + `consistent-type-imports`: use `import type` for type-only imports.

---

## §10 Styling (Tailwind)

- Utility-first via Tailwind; keep tokens in `tailwind.config.js` (`theme.extend`) rather than scattering arbitrary values (`w-[437px]`).
- Extract a component when a class list repeats or a markup pattern recurs — don't `@apply` your way around composition.
- Co-locate component styles with the component; no global CSS beyond `src/index.css` (Tailwind layers).

---

## §11 Accessibility

- Semantic HTML first; ARIA only to fill genuine gaps. `eslint-plugin-jsx-a11y` is on.
- Keyboard navigable; visible focus; manage focus on route/modal changes.
- Label every control; `aria-live` for async status (see `Home.tsx`). Meet WCAG AA contrast.

---

## §12 Performance

Baseline: route-level code-splitting (`React.lazy` + `Suspense`), measured memoization (`useMemo`/`useCallback`/`React.memo` where profiling shows benefit — not by default), bundle budgets, and `@tanstack/react-query`/Apollo caching to avoid refetching.

- **Lighthouse.** Run via Lighthouse CI (`pnpm lhci`, config in `lighthouserc.json`) against the built `dist/`, in CI (`.github/workflows/ci.yml`). Run locally before shipping perf-sensitive work. Know what it does and does not enforce: it asserts **four category scores** at `minScore: 0.9` — and only **accessibility** is `error`. Performance, best-practices and SEO are `warn`, so they report without failing the build. There are no per-metric budgets (LCP, CLS, TBT); add them to `lighthouserc.json` if you want them, and raise a category to `error` before relying on it as a gate. A `warn` assertion is a measurement, not a guardrail.
- **Service workers.** Offline/caching via `vite-plugin-pwa` (Workbox), wired in `vite.config.ts` (disabled in the skeleton). Enable per-project with an explicit caching strategy; register after load; handle the update/refresh flow (prompt or auto-update); beware stale caches — version your precache and test the upgrade path.
- **Cache-Control.** Vite emits content-hashed assets → serve them `Cache-Control: public, max-age=31536000, immutable`; serve `index.html` with `no-cache` (or short max-age) so new deploys are picked up. Coordinate CDN + service-worker caches so they don't serve stale bundles. (Headers are set at the host/CDN, not in client code.)
- **Streamed responses.** Consume `ReadableStream`/SSE incrementally — e.g. streaming LLM output from `@anthropic-ai/sdk` (server-side) relayed to the client. Read via `Response.body!.getReader()` (or `EventSource`), render tokens as they arrive, keep the UI responsive, and support cancellation via `AbortController`. Prefer streaming for any long-running generative response.

---

## §13 Testing

- **Offline unit/component tests (default).** Vitest + Testing Library + jsdom, with **MSW** intercepting all network (`onUnhandledRequest: 'error'` — unmocked requests fail). Inject `Fake*` repositories for pure logic; use MSW to exercise the HTTP/validation path. No real network, ever. Worked example: `src/features/health/services/useHealth.test.tsx`. Colocate as `*.test.ts(x)` next to the unit.
- **E2E (Playwright).** Scripted specs in `e2e/` run against the real dev server (`playwright.config.ts` boots `pnpm dev`) — the frontend analog of testcontainers integration tests. Run with `pnpm test:e2e`. Worked example: `e2e/smoke.spec.ts`.
- **Agent-driven browser tools.** Use them for interactive verification, design iteration,
  and profiling. They are not a test framework, so promote settled behavior into an `e2e/`
  spec. Prefer a text accessibility snapshot. Screenshots and screencasts are image inputs
  and require explicit user consent (see `AGENTS.md` Guardrails).
- Don't edit a test to make it pass — diagnose the root cause.

---

## §14 Dependency policy

The approved stack is fixed in `package.json`. Adding a new framework/library requires updating AGENTS.md + this file **first**, with a short rationale. Prefer editing `package.json` then `pnpm install` over ad-hoc `pnpm add`. Keep `pnpm-lock.yaml` committed; CI installs with `--frozen-lockfile`.

> **No `docker-compose.yml`:** a pure frontend has no database. The "real-environment / integration" analog here is Playwright E2E against the dev server. If a project later needs a mock backend or DB, add it then and document it here.

**`secretlint` (devDependency, pre-commit).** Scans every staged file for key patterns and fails the commit on a match. Chosen over `gitleaks`, the usual answer, because `gitleaks` is a Go binary needing a per-machine install that a clone does not inherit — the same friction the LSP setup already carries, and one copy of it is enough. `secretlint` installs from the lockfile, so a clone and CI get it with `pnpm install --frozen-lockfile` and no second setup step. Patterns live in `.secretlintrc.json`: the recommended preset plus this repo's own key shapes (Anthropic, Linear). Adding a provider means adding its pattern there — see `docs/secrets.md`.
