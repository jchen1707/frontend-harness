# Feature slices

Everything under `src/features/<name>/` is one slice. A slice owns its layers top to bottom:
`ui/` → `services/` → `repositories/` → `core`. `index.ts` is what the rest of the app sees.

The dependency rule itself is stated once in `docs/architecture.md` §1 and machine-enforced by
`eslint-plugin-boundaries`. This file covers what the config cannot check.

## Adding a slice

A new slice needs all four parts from the start, even if a layer is one file:

```
src/features/<name>/
  ui/            components and routes
  services/      hooks — business logic, TanStack Query / Apollo
  repositories/  transport behind an interface
    schemas/     Zod schemas for every response shape
  index.ts       the public surface
```

Register the element pattern in `eslint.config.js` if you invent a directory shape the config
does not name. **`eslint-plugin-boundaries` fails open**: a file no element matches is
unchecked, and the rule reports green anyway. A new shape with no pattern is the one way to
lose the architectural guarantee silently.

## What each layer may do

**`ui/`** — renders and handles interaction. It calls **one** service hook and shapes the
view. No `fetch`, no Apollo, no Zod parsing, no query keys. If a component needs data from two
sources, that composition belongs in a service hook, not in JSX.

**`services/`** — hooks. Business logic, derived state, coordination, and the `useQuery` /
`useMutation` / `useQuery`-from-Apollo calls. A service accepts its repository as an option
with a production default, so a test can pass a fake:

```ts
export function useHealth({ repository = httpHealthRepository }: UseHealthOptions = {}) { … }
```

That default is what keeps call sites clean and tests offline. A service that constructs its
own transport cannot be tested without the network.

**`repositories/`** — transport and validation only. No React, no hooks, no imports from
`services/` or `ui/`. Each repository is a TS `interface` with an `Http*` (or Apollo-backed)
implementation and a `Fake*` implementation beside it. Parse every response through the Zod
schema in `schemas/` before returning it; a response typed with `as` is unvalidated data
wearing a type. Throw the typed errors from `core/errors.ts` — let the service decide how to
surface them.

**`index.ts`** — export the components, hooks and types other slices legitimately need, and
nothing else. Every symbol here is a public API you have to keep working. Re-exporting a whole
module (`export * from './services/useThing'`) publishes internals by accident.

## Crossing slices

Import another slice **only** through its `index.ts`. If you need something it does not
publish, either it should publish it — a deliberate change to its public surface — or the
thing is genuinely shared and belongs in `src/core` (logic) or `src/components/ui`
(presentation). Promote deliberately; a slice reaching into another slice's `services/` is the
first step to a codebase with no boundaries at all.

Two slices that keep needing each other's internals are usually one slice.

## Deleting a slice

Delete the folder, then the routes that mounted it, then any `core`/`components` code that
existed only for it. If deleting a feature leaves orphans elsewhere, the slice was leaking.

## Tests live here

`*.test.ts(x)` next to the unit it covers, inside the slice. See `docs/architecture.md` §13
for what unit versus E2E means here, and `src/test/CLAUDE.md` for the MSW handlers.
