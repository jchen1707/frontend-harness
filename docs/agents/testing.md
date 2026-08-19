# Testing — this repo

<!-- harness:agnostic -->

**Shared doctrine lives in `.agents/vendor/harness/docs/agents/testing.md`** — the rules that
hold in every stack, and why `test-writer` is defined per stack rather than shared. It is
vendored from [`harness`](https://github.com/jchen1707/harness) and pinned by sha; read it
first.

<!-- /harness:agnostic -->
<!-- harness:claude
**Shared doctrine is provided by the `harness` plugin**, at
`${CLAUDE_PLUGIN_ROOT}/docs/agents/testing.md` — the rules that hold in every stack, and why
`test-writer` is defined per stack rather than shared. Read it first.
/harness:claude -->

This file records only what is true in **this** repo.

## Where tests go

- **Beside the code they cover**, inside the feature slice: `ui/Thing.test.tsx`,
  `services/useThing.test.tsx`, `repositories/thing.test.ts`. The slice owns its tests the
  same way it owns its layers.
- `src/test/msw/handlers.ts` — shared request handlers. Add an endpoint here; override
  per-test with `server.use(...)` for the error and empty cases.
- `e2e/` — Playwright specs. Full user journeys against a real browser, run by
  `pnpm test:e2e`, never by Vitest.

## The stack rules

1. **Seams here** are what the user can see and do: query with `getByRole` and
   `getByLabelText`, act with `userEvent`. Never assert on a class name, on a test id where a
   role exists, or on a hook's internal state.
2. **Unit and component tests are offline.** MSW intercepts every request; a test that would
   reach a real host is broken even while it passes.
3. **Cover the states users hit**: loading, error, empty, and the boundary values — not just
   the resolved happy path.
4. **Wait, do not sleep.** `findBy*` and `waitFor` for anything async.
5. **Type everything.** `tsc --noEmit` runs over tests too, and `any` is an error.
6. **Reach for Playwright only when the browser is the point** — real navigation, real layout,
   focus across a page load. Logic jsdom can cover belongs in Vitest.

## Finishing

`pnpm test`, and paste the output. For failing tests that encode a spec, quote the assertion
error to show they fail for the intended reason.
