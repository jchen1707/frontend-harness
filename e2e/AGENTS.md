# `e2e/` — Playwright specs

Scripted browser tests against a real dev server. `playwright.config.ts` boots `pnpm dev`
itself, so there is nothing to start by hand. Run with `pnpm test:e2e`; the browsers are a
separate download (`pnpm exec playwright install chromium`).

Vitest never runs these — `vite.config.ts` excludes `e2e/**`. They are the frontend analog of
the integration suite in `python-harness`: slower, realer, and not part of the default gate.

## What belongs here, and what does not

A journey belongs here when **the browser is the point**: real navigation and history, real
layout and viewport, focus surviving a page load, a service worker, a file upload, a flow
across several routes.

Everything else belongs in Vitest. A Playwright spec asserting logic that jsdom could cover is
slow, flaky coverage in the wrong place — and it fails minutes later, in CI, instead of in a
second on your machine.

Conversely, do not assert in jsdom what depends on real layout or real navigation. jsdom has
no layout engine; a passing test there proves nothing about it.

## Rules

1. **Query the way a user finds things.** `getByRole`, `getByLabel`, `getByText`. Playwright
   auto-waits on these, which is most of what makes a suite stable. A CSS selector tied to
   markup structure breaks on every refactor and tells you nothing when it does.
2. **Never sleep.** `waitForTimeout` is a flake with a delay attached. Wait for the state you
   actually need: a visible element, a URL, a response.
3. **One journey per spec file**, named for the journey. `smoke.spec.ts` covers "the app loads
   and the home route renders" and nothing else.
4. **Each test sets up its own state** and does not depend on the order tests run in.
   Playwright parallelises by file.
5. **Assert on user-visible outcomes** — what is on screen, where the URL went, what is
   announced. Not on internal state.
6. **Keep the suite small.** E2E cost is paid on every run by everyone. Cover the journeys
   that would be embarrassing to break; push the variations down into Vitest.

## Where these specs come from

The **Chrome DevTools MCP** server drives a browser interactively during `/run` and `/verify`.
That is the fast loop — building, iterating on design, debugging, profiling. It has no runner
and no assertions, so it can prove a thing works today and nothing more.

These specs are the other half: **explore there, promote here.** When a behaviour settles,
write it down as a spec. The test to write is the one that would have caught the bug you just
fixed by hand.

Two directions to resist:

- **Do not leave user-visible behaviour covered only by an agent walkthrough.** It costs
  tokens every run, and it cannot fail a build after everyone has forgotten the session.
- **Do not write a spec for everything you inspected.** Most of a fast-loop session is
  looking around. Promote the outcome, not the journey — see "Keep the suite small" above.

> **Image-input consent (hard rule).** A screenshot (`take_screenshot`) or a screencast feeds
> an image into the model. Stop and ask the user for permission first; prefer `take_snapshot`,
> which is text. See root `AGENTS.md` → Guardrails.
