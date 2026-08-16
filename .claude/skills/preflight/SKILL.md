---
name: preflight
description: Run before opening a PR. Checks the process gates the code gates cannot see — PR body, tracker state, test coverage of the diff, plan status, branch freshness — and produces the Evidence scorecard for the PR body. Use when about to run gh pr create, or when asked whether the work is ready to ship.
argument-hint: '[PR number to re-check] [--base branch]'
---

Read and execute `../../../.agents/skills/preflight/SKILL.md`.
