---
description: Run the test suite
---

Run the offline unit/component tests:

```bash
pnpm test
```

When UI behavior changed, also run the E2E suite (boots the dev server via Playwright):

```bash
pnpm test:e2e
```

- Run `pnpm install` first if dependencies changed; for E2E, ensure browsers are installed (`pnpm exec playwright install chromium`).
- Report pass/fail and any failures verbatim.
- **Do NOT modify tests just to make them pass** — diagnose the root cause.
- Unit tests are offline (MSW intercepts all network); never reach the real network.
- Per the Definition of Done, `pnpm test` must be green (and `pnpm test:e2e` when UI changed).
