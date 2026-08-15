# Harness compatibility

The repository contract is independent of Claude Code, Codex, or another agent harness.

| Concern             | Canonical location                  | Harness adapter                             |
| ------------------- | ----------------------------------- | ------------------------------------------- |
| Instructions        | `AGENTS.md` and nested `AGENTS.md`  | `CLAUDE.md` pointer files                   |
| Skills              | `.agents/skills/*/SKILL.md`         | `.claude/skills/*/SKILL.md` pointer skills  |
| Workflow state      | `.agents/plans/`                    | A harness may expose its own UI or commands |
| Reviewer prompts    | `.claude/agents/*.md` prompt bodies | Claude frontmatter and workflow runner      |
| Linear MCP          | Docker MCP Toolkit gateway          | `.mcp.json` and `.codex/config.toml`        |
| Chrome DevTools MCP | Hardened command flags              | `.mcp.json` and `.codex/config.toml`        |
| Lifecycle hooks     | `.claude/hooks/*.mjs` scripts       | Claude settings and `.codex/hooks.json`     |
| Deterministic gates | `package.json`, Husky, and CI       | Stop hooks are an extra Claude Code layer   |

## Capability discovery

At the start of a task, inspect available skills, tools, agents, and connected services. Map
them to the delivery stages in `.agents/skills/delivery/SKILL.md`. Do not assume a plugin is
installed because another harness has it.

When Matt Pocock's skills plugin is present, its clarification, specification, ticketing,
implementation, and review skills can implement the matching stages. When it is absent, use
the repository delivery skill. The artifacts and quality gates stay the same.

## MCP servers

Each harness keeps its native MCP configuration file. Both configurations start Docker MCP
Toolkit with `docker mcp gateway run`. Docker Desktop owns Linear authentication.

Claude Code reads `.mcp.json`. Codex reads `.codex/config.toml` after the user trusts the
project. Restart the active harness after either configuration changes.

Both adapters start Chrome DevTools with an isolated profile. They redact network headers.
They also disable usage statistics and CrUX requests.

## Codex network access

The trusted project config enables outbound network access in the workspace-write sandbox.
This permits package downloads, browser installation, MCP startup, and documentation access.
Codex still applies its filesystem sandbox and approval policy.

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

Codex runs the same path-protection, formatting, and Stop-gate scripts as Claude Code. Codex
requires the user to review and trust project hooks with `/hooks` after a hook changes.
