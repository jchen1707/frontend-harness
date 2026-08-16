---
name: delivery
description: Run this repository's harness-agnostic software delivery workflow. Use for planning, implementing, reviewing, or coordinating ticket-shaped work when an equivalent installed skill is unavailable.
argument-hint: '[request, issue, plan path, or workflow stage]'
---

# Delivery workflow

Treat tools and plugins as optional capabilities. Inspect the current harness before each
stage. Use a matching installed skill when it exists. Otherwise perform the stage directly.
Never stop only because a named plugin or slash command is missing.

## Stages

1. **Discover.** Read `AGENTS.md`, relevant nested `AGENTS.md`, architecture records, code,
   and the originating issue. State unknowns and constraints.
2. **Clarify.** Resolve decisions that materially change scope. Make safe reversible
   assumptions for the rest and record them.
3. **Specify.** Write observable outcomes, non-goals, constraints, and acceptance criteria.
4. **Split.** Create independently testable tickets. Record dependencies and one verification
   command per ticket.
5. **Implement.** Work one ticket at a time. Preserve architecture boundaries. Add a test
   that fails without the new behavior.
6. **Verify.** Follow `.agents/skills/verify/SKILL.md`. Add E2E verification for changed UI
   behavior.
7. **Review.** Compare the diff against the specification and repository standards. Use
   independent read-only agents when available. Run reviews sequentially when they are not.
8. **Deliver.** Update the issue, complete the PR template, include verification evidence,
   and record durable friction.

## State

Write durable workflow state below `.agents/plans/`. Use `plan.md`, `test-plan.md`, and
`loop-<goal>.md`. Each file states its status, source request or issue, assumptions, current
stage, completed work, remaining work, and exact verification commands.

Do not depend on chat history for a handoff. A fresh agent must be able to continue from the
plan, the ticket, the repository instructions, and the diff.

## Capability fallbacks

| Capability              | Preferred                                  | Fallback                                                                 |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| Specialized skill       | Installed skill or plugin                  | Execute this stage contract directly                                     |
| Parallel agents         | Isolated worktrees and read-only reviewers | One writing agent; sequential reviews                                    |
| Dynamic workflow engine | Fan out and fan in                         | Run the same stages in order and persist state                           |
| Issue tracker tool      | Connected tracker API or MCP               | Prepare the update and report the missing connection                     |
| Symbol navigation       | LSP                                        | `rg`, then inspect definitions and imports manually                      |
| Browser inspection      | Browser automation tool                    | Playwright spec or manual instructions                                   |
| Visual design skill     | Installed design skill                     | Record palette, type, spacing, layout, states, and one signature element |

Plugins may add better prompts or automation. They do not redefine repository standards.
`AGENTS.md` and nested `AGENTS.md` always win.
