# `src/core/` — cross-cutting primitives

The bottom of the dependency graph. Every layer may import `core`; `core` imports nothing
above it — not a feature, not a component, not a hook. `src/env.ts` sits beside it under the
same rule.

`core` is **not a junk drawer**. A module belongs here when more than one feature genuinely
needs it and it carries no feature knowledge. Everything else lives in the slice that uses it.

## What lives here

| Module            | Owns                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `http.ts`         | the `fetch` wrapper: JSON, timeouts, cancellation, error mapping |
| `errors.ts`       | the typed error hierarchy                                        |
| `logger.ts`       | structured logging — the only sanctioned `console`               |
| `queryClient.ts`  | the TanStack Query client and its defaults                       |
| `apolloClient.ts` | the Apollo client, link chain and cache config                   |

## Configuration

Read env **only** through `src/env.ts`, which parses `import.meta.env` with Zod once, at
module load. A bare `import.meta.env.VITE_X` anywhere else skips validation and hides the
variable from the one place that documents it.

Adding a variable means adding it to the schema in `env.ts`, to `.env.example`, and — if it is
required — giving it no default so a missing value fails loudly at startup rather than
producing `undefined` three layers down.

**Only `VITE_`-prefixed variables reach the browser, and they are public.** Vite inlines them
into the bundle as literals. A key behind a `VITE_` name is published to every visitor.
`ANTHROPIC_API_KEY` and `GH_TOKEN` are server and build-side only.

## Errors

`AppError` is the root; `HttpError` carries a `status`; `ValidationError` marks a boundary
that rejected its input. Throw these from repositories so services can branch on the type
instead of on a message string.

Preserve the cause: `new HttpError(message, status, { cause: original })`. An error that
discards its cause turns a five-second diagnosis into a bisect.

Never catch to silence. If a failure is genuinely expected, handle it explicitly and log at
`warn` with the context that makes it recognisable.

## Logging

`logger.ts` is the only file allowed to call `console`; ESLint enforces this everywhere else,
and the Definition of Done forbids stray output. Log with **bound context**, not interpolated
strings — `logger.warn('health check failed', { status, path })`, so the fields stay
machine-readable.

Never log a token, a password, a full auth header, or a whole user object.

## The HTTP wrapper

`request<T>()` already links an external `AbortSignal` to its own timeout, so a query's signal
propagates and a stale response cannot resolve. Pass the signal through from the service
layer; a repository that ignores it reintroduces the race the wrapper exists to remove.

`request` returns `Promise<T>` and does **not** validate — validation is the repository's job,
with the Zod schema that describes that endpoint. Keeping the two apart is what lets one
wrapper serve every shape.

## Clients

`queryClient.ts` and `apolloClient.ts` hold defaults that apply app-wide: retry policy,
`staleTime`, cache normalisation, the link chain. Change them deliberately — a default here
changes the behaviour of every query in the app, including the ones nobody re-tested.

Per-resource tuning belongs at the call site in the slice's `services/`, not in these files.
