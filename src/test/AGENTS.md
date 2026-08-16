# `src/test/` — test infrastructure

Shared setup for the offline suite. Nothing here is application code; nothing here should
contain assertions.

## MSW is the network boundary

`msw/server.ts` starts the interceptor for every Vitest run (wired in `vitest.setup.ts`), with
`onUnhandledRequest: 'error'`. **An unmocked request fails the test rather than reaching the
network.** That is the guarantee that makes the suite offline, and it is deliberate: a test
that silently hit a real host would pass on your machine and fail in CI, or worse, pass in
both while testing somebody else's uptime.

`msw/handlers.ts` holds the default handlers — the happy path for each endpoint the app uses.
It doubles as a catalogue of the app's outbound surface, so keep it accurate.

## Adding coverage

- **A new endpoint** → add its default handler to `handlers.ts`, matching the real response
  shape. If the shape is wrong, every test using it is testing a fiction.
- **An error, empty or slow case** → override per test with `server.use(...)`. Do not add a
  second permanent handler; a default that returns an error makes every other test fight it.
- Reset happens between tests, so an override cannot leak into the next one.

## The browser worker

`msw/browser.ts` is the dev-and-E2E worker, started from the entry point when
`VITE_MOCK_API` is on. Three rules keep it from breaking the app it mocks:

1. **Start it from an async bootstrap function, never with top-level `await`.** The es2020
   build target rejects top-level `await`, `typecheck` does not check the target, and only
   `pnpm build` fails — which is why `pnpm build` is a gate.
2. **Wrap the start in `try/catch` and let the app render on failure.** `start()` can reject
   on scope conflicts, private-browsing restrictions, or a missing `mockServiceWorker.js`;
   unguarded, the root stays blank. Log through `core/logger.ts`.
3. **Fail loudly on unhandled API requests.** The browser default is `bypass`, which lets a
   missing handler reach a real backend. Use an `onUnhandledRequest` callback that
   `print.error()`s any request under `VITE_API_BASE_URL`, so dev behaves like the unit
   suite.

## Choosing MSW or a fake repository

Both are legitimate; they test different things.

- **`Fake*` repository** — for service and UI logic. Fastest, and it isolates the hook from
  transport entirely. Use it when the question is "does this logic do the right thing?".
- **MSW** — for the repository layer and anything that must exercise real parsing. Use it when
  the question is "does this survive the actual response?", including the Zod validation and
  the error mapping in `core/http.ts`.

A test that mocks the module it is testing exercises the mock. Mock at the network, or inject
at the seam — never in between.

## Rules

1. **No assertions in this directory.** Setup and fixtures only.
2. **Keep handlers honest.** A handler that returns a shape the server never returns turns the
   whole suite into wishful thinking. Derive it from the schema in the slice's
   `repositories/schemas/`.
3. **Type the fixtures.** `tsc --noEmit` covers tests too, and `any` is an error.
4. **No timing dependence.** No `setTimeout` in a fixture to "let things settle"; the test
   should wait on the assertion with `findBy*` or `waitFor`.
