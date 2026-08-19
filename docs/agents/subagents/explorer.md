# Codebase map — frontend-harness

The stack half of the shared `explorer` frame. The frame carries the method and the output
shape; this is where to look and what the same idea is called here.

```
src/features/<name>/     ← a feature slice
├── ui/                  ← components
├── services/            ← hooks, orchestration
├── repositories/        ← data access, and the fakes the tests use
└── index.ts             ← what this slice publishes to the rest of the app
src/core/                ← HTTP wrapper, Apollo and Query clients, logger, error types
src/components/ui/       ← shared presentational primitives
src/env.ts               ← the only place import.meta.env is read
src/test/msw/            ← request handlers, which double as a catalogue of the endpoints in use
e2e/                     ← Playwright specs
docs/architecture.md     ← standards and the decision record
docs/agents/             ← the stack half of layer A, including this file
```

Group your answer **by feature slice** when it spans several. That is how this codebase is
organised, and it tells the caller where the work belongs.

`src/features/<name>/index.ts` is the slice's public surface: reading it is usually faster than
searching the slice, and it is the honest answer to "what can I use from here?"

## Synonyms to try before reporting nothing

The same concept travels under several names here.

- A **user** may be `user`, `account`, `profile` or `viewer`.
- A **fetch** may be a `useQuery`, a repository function, or a GraphQL document.
- A **form** may be `form`, `schema`, `resolver` or `fields`.
- A **route** may be in the router config, a lazy import, or a directory name.

## Prefer the language server

The `LSP` tool's `findReferences` distinguishes a call from a mention in a comment or a JSX
string, and — unlike grep — it follows re-exports through a slice's `index.ts`. Grep alone will
tell you a widely-used export is unused.

A confident "nowhere" is the most expensive answer you can give. Say which names you tried.
