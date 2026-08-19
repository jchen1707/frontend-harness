# Harness compatibility

The repository contract is independent of Claude Code, Codex, or another agent harness.

| Concern             | Canonical location                  | Harness adapter                                 |
| ------------------- | ----------------------------------- | ----------------------------------------------- |
| Instructions        | `AGENTS.md` and nested `AGENTS.md`  | `CLAUDE.md` pointer files                       |
| Skills              | `.agents/skills/*/SKILL.md`         | `.claude/skills/*/SKILL.md` pointer skills      |
| Shared skills       | `harness`, one source               | Vendored, plus a stub under `.agents/skills/`   |
| Workflow state      | `.agents/plans/`                    | A harness may expose its own UI or commands     |
| Reviewer frames     | `harness`, one source               | Vendored under `.agents/vendor/harness/agents/` |
| Reviewer checklists | `docs/agents/subagents/*.md`        | Read alongside the frame, in that order         |
| This repo's agents  | `.claude/agents/*.md` prompt bodies | Claude frontmatter and workflow runner          |
| Linear MCP          | Docker MCP Toolkit gateway          | `.mcp.json` and `.codex/config.toml`            |
| Chrome DevTools MCP | Hardened command flags              | `.mcp.json` and `.codex/config.toml`            |
| Lifecycle hooks     | `.claude/hooks/*.mjs` scripts       | Claude settings and `.codex/hooks.json`         |
| Deterministic gates | `package.json`, Husky, and CI       | Stop hooks are an extra Claude Code layer       |
| Shared harness half | `jchen1707/harness`, one source     | Vendored here; the plugin on `main`             |

## The shared half arrives through an adapter too

The stack-neutral content — the eight workflow commands, the eight shared review frames, the
shared skills and `full-review.js`, plus tracker conventions, the triage mapping, domain-doc
rules and secret doctrine — is owned once in
[`harness`](https://github.com/jchen1707/harness) and reaches this repo the same way
everything else does: through whichever adapter the harness understands.

None of it names `pnpm`, `src/features/` or a Linear team key. It reads them from
`harness.config.json` at this repo's root, which is the contract that makes one authoring
possible — see `.agents/vendor/harness/docs/agents/config.md`.

| Harness                  | How it arrives                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| Claude Code              | The `harness` plugin, resolved via `${CLAUDE_PLUGIN_ROOT}`        |
| Codex, and anything else | Vendored into `.agents/vendor/harness/`, pinned by sha, committed |

This branch takes the vendored path, so nothing here depends on a Claude Code mechanism.
The plugin would make `v2` Claude-only in everything but name, which is the opposite of
what this document is for.

**A submodule is not a third option.** `git worktree add` does not populate one — no error,
no warning, just an empty directory — and this repo runs worktree-per-ticket. Vendored
files are ordinary tracked content, so a worktree and a sandbox both materialise them.

Vendoring's cost is staleness, and the answer is to make staleness loud rather than to
pretend there is no copy: `.github/workflows/vendor-freshness.yml` fails the build when the
vendored tree has been hand-edited or the pin has fallen behind. **Never edit
`.agents/vendor/harness/` here** — it is generated, and the next sync overwrites it.

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
