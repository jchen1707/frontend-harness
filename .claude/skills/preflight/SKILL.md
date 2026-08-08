---
name: preflight
description: Run before opening a PR. Checks the process gates the code gates cannot see — PR body, tracker state, test coverage of the diff, plan status, branch freshness — and produces the Evidence scorecard for the PR body. Use when about to run gh pr create, or when asked whether the work is ready to ship.
argument-hint: '[PR number to re-check, or blank for the current branch]'
---

`/verify` proves the diff works. This skill proves the **workflow was followed**. Every
check below is a step that leaked during a real run (the FRO-5 shakedown, 2026-08-08):
gates that passed only in CI, an empty PR body, a tracker stuck in Todo, a stale plan
status, a diff with unguarded behaviour.

Report each check as **PASS / FAIL / N-A with one line of evidence** — a command output, a
file line, a tool result. Never a bare assertion. Evidence you cannot produce means the
check FAILED.

## The checks

Run them in order. Independent checks can run in parallel.

1. **Code gates.** All six Definition-of-Done gates have evidence from this session:
   `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
   `pnpm test:e2e` when UI behaviour changed. Run any gate that has no evidence yet.
   Evidence: the tail of each command's output.

2. **The diff is guarded.** Compare the diff against the merge-base
   (`git diff --stat $(git merge-base HEAD main)`). Every changed behaviour under `src/`
   has a changed or added test; changed UI behaviour has an `e2e/` spec. A diff that
   changes `src/` and touches no test file FAILS unless the change is provably
   behaviour-free (types, comments, renames). Evidence: the paired source and test paths.

3. **Branch freshness.** `git fetch origin` ran this unit of work; the branch is based on
   current `origin/main`; any PR this session contributed to has had its merge state
   re-checked (`gh pr view <n> --json state`). Evidence: the fetch and the base check.

4. **PR body.** The draft body exists and fills every template section — Summary (with
   `Fixes FRO-n` when a ticket exists), What changed, How to demo, Evidence, Screenshots
   or snapshot, Risks. `pr-template.yml` will reject placeholders, so catch it here first.
   Evidence: the section headings present, and the character count of real content.

5. **Tracker state.** The Linear issue resolved from the branch name is In Progress now
   and will move to In Review with the PR attached (manually, or by the GitHub
   integration — do not assume it is installed; `docs/agents/issue-tracker.md` → Status
   sync). N-A when no ticket exists. Evidence: the issue state from the get-issue tool.

6. **Plan status.** `.claude/plans/plan.md` (when this work used one) has its `Status:`
   line matching reality right now. A line describing a process as "running" from an
   earlier session is a FAIL — fix the line. Evidence: the quoted line.

7. **Learnings.** Friction from this work is captured — `/retro` ran, or there is an
   explicit "no friction worth keeping". Evidence: the memory file written, or the
   one-line statement.

## Output

Produce one scorecard table:

| #   | Check | Result | Evidence |
| --- | ----- | ------ | -------- |

Paste it into the PR body's **Evidence** section, and show it in the turn report.

**A FAIL blocks the PR.** Fix it, or name it to the user and get an explicit override —
never open the PR with a silent FAIL. N-A always states its reason.

## The ledger

Append one line per run to `.claude/plans/preflight-ledger.md` (gitignored; create it with
a header row if missing):

```
| date | branch | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
```

One cell per check: `P`, `F` (fixed-before-open counts as `F` — the ledger records what
the process caught, not the final state), or `-`. The ledger is the eval loop: after a few
runs it shows which step leaks most, so `/retro` can target the harness instead of
guessing. Do not commit it; do not rebuild it from memory — append only.
