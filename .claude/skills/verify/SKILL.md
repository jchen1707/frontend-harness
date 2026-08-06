---
name: verify
description: Run the Definition of Done gates and report the actual output as evidence. Use before claiming work is complete, before opening a PR, or whenever asked whether the change actually works.
argument-hint: '[--e2e] [--perf] [--browser]'
allowed-tools: Bash(pnpm:*), Bash(npx playwright:*), Read, Grep, Glob
---

Prove the change works. **Paste real command output — never assert success.**

The same four gates run automatically in the `Stop` hook (`.claude/hooks/verify.mjs`), but
only when the turn touched gated source or the tool config. Invoke this skill when you want
the evidence in the transcript, or to cover the cases the hook deliberately skips.

## Gates

Run in order and **stop at the first failure** — a later gate's output is meaningless once
an earlier one fails.

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Run `pnpm install` first if dependencies changed.

With `--e2e` in `$ARGUMENTS`, also run the browser suite. Playwright boots the dev server
itself; the browsers are a separate download:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

With `--perf`, run the performance budget against a production build:

```sh
pnpm build
pnpm lhci
```

## Reporting

For each gate, report the command, its exit status, and the tail of its output. Then one of:

- **PASS** — every gate green. State which gates ran and which were skipped.
- **FAIL** — name the first failing gate, quote the failure, and state the root cause if you
  can see it. Do not attempt the fix inside this skill; report and let the caller decide.

Three failure modes to call out explicitly rather than glossing:

- **No tests exist for the changed behaviour.** A green `pnpm test` proves nothing then. Say
  so — "12 passed, none covering the new code path" is the honest line.
- **`pnpm lint` passed but a boundary rule matched nothing.** `eslint-plugin-boundaries` fails
  open: a file no element pattern classifies is simply unchecked, so the architectural rule
  can pass vacuously. If the diff added a directory shape the config does not name, report
  the gate as **not covering** that file.
- **A gate could not run** (browsers not installed, no build output for Lighthouse). That is
  not a pass. Report it as skipped, with the reason.

## Verifying in a browser

A green suite is not proof the app renders. When the change is user-visible, drive the
running app with the **Playwright MCP** server: `pnpm dev`, navigate, and read the
**accessibility snapshot** — it is text, it needs no consent, and it is a better assertion
target than a picture because it shows the roles and names assistive technology exposes.

Report what the snapshot showed: the route, the landmark and heading structure, the control
you exercised, and the state after.

> **Image-input consent (hard rule).** A screenshot — including Playwright MCP
> `browser_take_screenshot` — feeds an image into the model. **Stop and ask the user for
> permission first, and do not proceed until they confirm.** Prefer the snapshot; it answers
> most questions a screenshot would.
