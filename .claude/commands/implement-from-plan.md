---
description: Hand .claude/plans/plan.md + test-plan.md to the /implement skill as its spec, with this repo's pnpm gates pinned (terminal 2, implementation model)
argument-hint: '[path to a plan file, or blank for .claude/plans/plan.md]'
---

Two-terminal workflow — **terminal 2 (implementation model)**. This is a thin adapter over
the `mattpocock-skills` `/implement` skill: that skill implements "a spec or set of tickets"
but does **not** know about this repo's plan files, its feature-slice layering, or its gates.
This command supplies all three.

1. **Locate the plans.** Default to `.claude/plans/plan.md` and `.claude/plans/test-plan.md`;
   if `$ARGUMENTS` names a path, use that as the implementation plan and look for a sibling
   `test-plan.md`.
   - If `plan.md` is missing, **STOP** and tell the user to run `/plan` in terminal 1 first.
     Do not improvise a plan here — planning is a separate, signed-off step.
   - If `test-plan.md` is missing, ask the user whether to proceed without it or go back to
     `/plan`. Don't silently skip the test plan.
2. **Read both files in full** before doing anything else. The plan is the source of truth: do
   not re-plan or re-scope it. If a Step looks wrong or impossible, flag it to the user and
   ask — don't quietly substitute your own approach.
3. **Confirm the branch.** `/plan` creates the feature branch off the user's chosen base. Run
   `git branch --show-current`; if you're on `main`, stop and ask which branch to use — per
   CLAUDE.md, direct commits to `main` need an explicit user request.
4. **Invoke `/implement` with the plans as the spec.** Say explicitly that the spec is
   `.claude/plans/plan.md` plus `.claude/plans/test-plan.md`, and pass along:
   - the numbered **Steps** from `plan.md` as the task list (build it with `TaskCreate`, one
     task per Step, marking each in_progress/complete as you go);
   - the **test cases** from `test-plan.md` as the cases to drive `/tdd` with, and the
     **seams** it names as the pre-agreed seams (`/tdd` requires seams be confirmed before any
     test is written — the test plan is that confirmation);
   - the **Open questions** from `plan.md`, to raise with the user rather than guess.
5. **Pin the layering — code lands in a slice, not in a folder of its kind.** New code goes in
   `src/features/<slice>/` under the right layer (`ui/` → `services/` → `repositories/` →
   `core`). Cross-feature reuse goes through the other slice's `index.ts`, or gets promoted to
   `src/core` or `src/components/ui` deliberately. Read `src/features/CLAUDE.md` before the
   first edit.
6. **Pin the gates.** The plugin skills say "run typechecking" and "run the test suite"
   generically. Wherever a skill says that, substitute the commands from **CLAUDE.md → Quick
   commands**: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and
   `pnpm test:e2e` when UI behaviour changed. For a single file,
   `pnpm exec vitest run <path>`.
7. **Finish to the Definition of Done** (CLAUDE.md). Run `/verify` for the evidence — paste
   the real output rather than asserting the gates passed. Then `/code-review` with the
   merge-base as the fixed point (`git merge-base HEAD main`) and no Standards findings
   outstanding. The `Stop` hook re-runs the gates independently, so a turn cannot end on
   failing source under `src/`, `e2e/` or `.claude/hooks/`.
8. **Update the plans as you go** — tick off Steps in `plan.md` and cases in `test-plan.md` as
   they land, so an interrupted session can resume from the files. Append divergences under a
   `## Deviations` heading; never rewrite the approved Goal, Approach or Steps.
   - _Material_ deviation (changed approach, public signature, layer boundary, scope, or an
     open question) → **STOP and re-confirm with the user.**
   - _Immaterial_ (helper names, file splits, fixing pseudocode bugs) → proceed and log it.
9. **Commit and stop.** `/implement` commits to the current branch. Opening the PR is a
   separate, explicit step — run `gh pr create` only if the user asks. Report what landed,
   what's left, and anything the plan got wrong.

> Do not feed any image into the model without explicit user permission (CLAUDE.md
> Guardrails). Verify with the Chrome DevTools MCP `take_snapshot` (text a11y tree) instead.
