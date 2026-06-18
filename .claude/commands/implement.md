---
description: Implement an approved plan and open a PR (terminal 2)
---

You are the **implementation** model (terminal 2). Build from the approved plans.

1. **Read `.claude/plans/plan.md` and `.claude/plans/test-plan.md`.** If either is missing,
   stop and tell the user to run `/plan` first.
2. **Build a task list** from the numbered Steps + test cases.
3. **Implement per layer** (UI → Service → Repository), explicit types on every exported
   function, Zod validation at repository boundaries, Tailwind for styling.
4. **Write tests** — offline unit/component (Vitest + Testing Library + MSW), and E2E
   (Playwright) when UI behavior changed.
5. **Verify:** `/lint` → `/test` → `/review`. All gates must be green.
6. **Update plans append-only.** Never rewrite the approved Goal/Approach/Steps; record
   divergences under a `## Deviations` section.
   - _Material_ deviation (changed approach, public signature, layer boundary, scope, or an
     open question) → **STOP and re-confirm with the user.**
   - _Immaterial_ (helper names, file splits, fixing pseudocode bugs) → proceed and log it.
7. **Auto-PR.** Commit the feature branch, push, and open a PR with `gh pr create`. Never
   commit directly to `main`. If gates are red, fix them first.

> Do not feed any image into the model without explicit user permission (CLAUDE.md Guardrails).
