# Harness compatibility

The repository contract is independent of Claude Code, Codex, or another agent harness.

| Concern             | Canonical location                  | Harness adapter                             |
| ------------------- | ----------------------------------- | ------------------------------------------- |
| Instructions        | `AGENTS.md` and nested `AGENTS.md`  | `CLAUDE.md` pointer files                   |
| Skills              | `.agents/skills/*/SKILL.md`         | `.claude/skills/*/SKILL.md` pointer skills  |
| Workflow state      | `.agents/plans/`                    | A harness may expose its own UI or commands |
| Reviewer prompts    | `.claude/agents/*.md` prompt bodies | Claude frontmatter and workflow runner      |
| Deterministic gates | `package.json`, Husky, and CI       | Stop hooks are an extra Claude Code layer   |

## Capability discovery

At the start of a task, inspect available skills, tools, agents, and connected services. Map
them to the delivery stages in `.agents/skills/delivery/SKILL.md`. Do not assume a plugin is
installed because another harness has it.

When Matt Pocock's skills plugin is present, its clarification, specification, ticketing,
implementation, and review skills can implement the matching stages. When it is absent, use
the repository delivery skill. The artifacts and quality gates stay the same.

## Loops

A loop has a goal, persisted state, one bounded pass, verification, and a stop condition. Use
`.agents/skills/loop-goal/SKILL.md`. A harness-native recurring goal may drive it, but the
plan file remains the portable checkpoint.

## Dynamic workflows

The full-review workflow fans a diff out to reviewer prompts and ranks the results. Harnesses
with agent spawning should run independent reviewers concurrently. Other harnesses should run
the same prompts sequentially. Concurrency changes latency, not review semantics.

## Enforcement boundary

Claude Code hooks are convenience enforcement. They do not run in every harness. Git hooks,
package scripts, tests, and CI are the portable enforcement layer. Every agent must run the
verification skill before it reports completion.
