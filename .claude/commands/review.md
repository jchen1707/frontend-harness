---
description: Review changes against the harness standards
---

Review for adherence to the standards in `docs/architecture.md` and the Definition of Done
in CLAUDE.md.

1. **Determine the target.** A PR (from `$ARGUMENTS` or the current branch) or local changes.
   Use `gh pr view --json`, `gh pr diff`, and `gh api` to inspect a PR.
2. **Load standards.** Read `docs/architecture.md` + the "Definition of Done" and "Stack"
   sections of CLAUDE.md.
3. **Check each changed file** against: layering (no reverse/lateral deps), interfaces over
   implementations, Zod validation at boundaries, REST/GraphQL best practices, config/secrets
   rules (no `VITE_`-prefixed secrets), strict types (no `any`, explicit boundary types),
   logging via `core/logger.ts` (no stray `console.*`), accessibility, tests present, and
   the approved stack.
4. **Report.** For a PR, post findings in one pass — inline comments + a summary with a
   PASS/FAIL checklist. Otherwise report in-session.

You may drive the running app via Playwright MCP to verify behavior; prefer the text
accessibility snapshot.

> **Image-input consent (hard rule):** before any screenshot (e.g. Playwright MCP
> `browser_take_screenshot`), stop and explicitly ask the user for permission.
