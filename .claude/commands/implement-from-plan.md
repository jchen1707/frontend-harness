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
   - the **Open questions** from `plan.md`, to raise with the user rather than guess;
   - the **Design direction** from `plan.md` as the visual spec for everything under `ui/` —
     follow it rather than re-deriving taste mid-build. If the plan has none and the work
     adds user-visible UI, load the `frontend-design` skill before the first component,
     choose a direction, and log the choice under `## Deviations`. Its tokens land in
     `tailwind.config.js`, never as arbitrary values.
5. **Pin the layering — code lands in a slice, not in a folder of its kind.** New code goes in
   `src/features/<slice>/` under the right layer (`ui/` → `services/` → `repositories/` →
   `core`). Cross-feature reuse goes through the other slice's `index.ts`, or gets promoted to
   `src/core` or `src/components/ui` deliberately. Read `src/features/CLAUDE.md` before the
   first edit.
6. **Pin the gates.** The plugin skills say "run typechecking" and "run the test suite"
   generically. Wherever a skill says that, substitute the commands from **CLAUDE.md → Quick
   commands**: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
   and `pnpm test:e2e` when UI behaviour changed. For a single file,
   `pnpm exec vitest run <path>`. `pnpm build` is a gate: only the build checks the browser
   target, so a top-level `await` passes `typecheck` and still breaks CI.
7. **Iterate in the browser with Chrome DevTools MCP, not with the Playwright suite.** The
   fast loop is `pnpm dev` → `navigate_page` → `take_snapshot` (text a11y tree, no consent
   needed) → `list_console_messages`. Re-running `pnpm test:e2e` to check "did my change
   render?" is the slow path and asserts nothing new. Playwright is the regression net:
   when a behaviour settles, write the **minimal** spec into `e2e/` once, run the suite once
   to prove it, and move on (CLAUDE.md → Browser work: explore → promote).
8. **Finish to the Definition of Done** (CLAUDE.md). Run `/verify` for the evidence — paste
   the real output rather than asserting the gates passed. Then `/code-review` with the
   merge-base as the fixed point (`git merge-base HEAD main`) and no Standards findings
   outstanding. The `Stop` hook re-runs the gates independently, so a turn cannot end on
   failing source under `src/`, `e2e/` or `.claude/hooks/`.
9. **Update the plans as you go** — tick off Steps in `plan.md` and cases in `test-plan.md` as
   they land, so an interrupted session can resume from the files. Keep the `Status:` line at
   the top of `plan.md` current, **in the same turn the state changes** — writing "review is
   running" and leaving it there after the session ends plants a lie for the next reader.
   Append divergences under a `## Deviations` heading; never rewrite the approved Goal,
   Approach or Steps.
   - _Material_ deviation (changed approach, public signature, layer boundary, scope, or an
     open question) → **STOP and re-confirm with the user.**
   - _Immaterial_ (helper names, file splits, fixing pseudocode bugs) → proceed and log it.
10. **Commit, and open the PR only when asked.** `/implement` commits to the current branch.
    Opening the PR is a separate, explicit step — run `gh pr create` only if the user asks.
    When you do open one:
    - Run `/preflight` first. It checks the process gates the code gates cannot see — body,
      tracker, test coverage of the diff, plan status — and produces the Evidence scorecard.
    - The body follows `.github/PULL_REQUEST_TEMPLATE.md`. **Never open a PR with an empty
      body** — fill Summary, What changed, How to demo and Evidence from the plan and the
      `/verify` output already in hand. CI enforces this (`pr-template.yml`).
    - Sync Linear in the same turn: **In Review**, PR attached, evidence commented
      (`docs/agents/issue-tracker.md` → Status sync).

    Report what landed, what's left, and anything the plan got wrong.

> Do not feed any image into the model without explicit user permission (CLAUDE.md
> Guardrails). Verify with the Chrome DevTools MCP `take_snapshot` (text a11y tree) instead.
