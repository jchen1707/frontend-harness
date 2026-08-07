# Issue tracker: Linear

Issues, specs and tickets for this repo live in **Linear**, reached over MCP. **Pull requests
stay on GitHub** — Linear holds the work item, GitHub holds the diff.

## Connecting

Linear is declared in this repo's **`.mcp.json`** as a remote Streamable HTTP server
(`https://mcp.linear.app/mcp`), authenticated with a bearer token read from
`LINEAR_API_KEY`.

- Check it with `/mcp`; it appears as **linear**.
- MCP servers load at **session start**. Changing the config or the key does not take effect
  until you restart.
- If the tools are missing, the key is almost always the reason. Confirm `LINEAR_API_KEY` is
  set **in the environment** — Claude Code expands `${LINEAR_API_KEY}` from there, not from
  `.env`, so a key that only exists in `.env` will not authenticate anything.

### Why not the claude.ai account connector

The connector is **one Linear connection for the whole account**. Pointing it at a different
workspace moves every project at once, and `python-harness` is on a different workspace with
its own triage labels — so one repo's tracker change would silently break the other's
`/triage`.

A Linear **personal API key belongs to the workspace it was created in**. Declaring the
server per repo with a per-repo key makes the binding structural: this repo can only ever
reach one workspace, and no account-level action can move it.

**Do not run both.** If the account connector is still connected you get two Linear tool
surfaces — `mcp__linear__*` and `mcp__claude_ai_Linear__*` — pointing at possibly different
workspaces, and nothing tells you which one a write landed in. Disconnect the connector in
claude.ai settings once this server works.

### Rotating or repointing

Create the key at **Linear → Settings → Security & access → Personal API keys**, scoped to
the workspace this repo should use. Set it in your **user** settings (`~/.claude/settings.json`
→ `env`) or your shell profile — never in this repo's committed `.claude/settings.json`, which
every clone would inherit. Moving this repo to a different workspace means issuing a key in
that workspace and restarting; no repo file changes.

## Workspace and team

|                    | Value                                                      |
| ------------------ | ---------------------------------------------------------- |
| Workspace          | **Development** (`development-jchen`)                      |
| Team for this repo | **Frontend**, key **`FRO`** — issues read `FRO-123`        |
| Sibling team       | **Backend**, key `BAC` — not this repo's; do not file here |

The team key is the issue-id prefix, and `/code-review` resolves a ticket from it, so a
branch named with the wrong prefix silently loses its spec axis.

Note the key is **not** returned by the MCP `get_team` tool — it exposes id, name, icon and
timestamps only. Read it from Linear's GraphQL API (`{ teams { nodes { key name } } }`,
authenticating with the same personal key) or from any issue id in the UI.

## Discovering the tools

**List the tools before first use rather than assuming names.** The surface changes between
releases, and the prefix depends on the server name in `.mcp.json` — `mcp__linear__*` here.

`/mcp` shows the connected servers and their tools. Match the operation you need from the
table below to what is actually offered.

## Conventions

| Operation               | What to call                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **Create an issue**     | the create-issue tool — needs `team`; set `title`, `description` (markdown), optional `labels`, `project` |
| **Read an issue**       | the get-issue tool, with the identifier (`FRO-123`)                                                       |
| **List issues**         | the list-issues tool — filter by `team`, `state`, `assignee`, `label`                                     |
| **Comment**             | the create-comment tool, with the issue id and markdown `body`                                            |
| **Apply/remove labels** | the update-issue tool, setting the `labels` array                                                         |
| **Change state**        | the update-issue tool, with the target workflow state                                                     |
| **Close**               | move to the team's Done/Cancelled state — Linear has no separate close verb                               |

Issue identifiers are `TEAM-NUMBER` (e.g. `FRO-4521`), not bare integers. A reference like
`#42` in conversation is **not** a Linear id — ask which team it belongs to rather than
guessing. `#42` in this repo's conversation usually means a GitHub PR.

## Labels vs workflow states

Linear separates **workflow state** (Backlog / Todo / In Progress / Done — a single value that
drives the board) from **labels** (many per issue). The five canonical triage roles in
`triage-labels.md` are **labels**, not states. Applying `ready-for-agent` does not move the
issue across the board; set the state explicitly when the role implies one.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the **Frontend** team (`FRO`). Put the spec in the issue
`description` as markdown. If the skill produced a document longer than fits comfortably, put the summary and
acceptance criteria in the description and link the full document.

## When a skill says "fetch the relevant ticket"

Get the issue by identifier, then read its comments for the discussion.

## Wayfinding operations

Used by `/wayfinder`. The **map** is one issue; **tickets** are its children.

- **Map** — an issue labelled `wayfinder:map` holding the Notes / Decisions-so-far / Fog body.
- **Child ticket** — a Linear **sub-issue** of the map (`parent` field), labelled
  `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking** — Linear has native issue relations: use the **blocks / blocked-by** relation
  rather than a text convention. A ticket is unblocked when every blocker reaches a completed
  state.
- **Frontier query** — the map's sub-issues that are not Done, have no unresolved blocked-by
  relation, and no assignee; first in map order wins.
- **Claim** — assign the issue to the current user; this is the session's first write.
- **Resolve** — comment the answer, move to Done, then append a pointer to the map's
  Decisions-so-far.

## Repo-specific notes

- The **Standards** axis of `/code-review` reads `docs/architecture.md` (authoritative), the
  summary in `CLAUDE.md`, and the nested `CLAUDE.md` for whichever directory the diff touches.
  Those override the skill's generic smell baseline.
- The **Spec** axis resolves the originating ticket from the Linear id in the branch name or
  commit trailer. Name branches `<type>/FRO-<num>-<slug>` (e.g. `feat/FRO-412-search-filters`)
  so the link is mechanical. When there is no ticket, it falls back to `.claude/plans/plan.md`.
- Definition of Done lives in `CLAUDE.md`; `/verify` runs those gates and prints evidence.
- Nine axes instead of two: `.claude/workflows/full-review.js`, run with `/workflows`. That is
  real spend — reach for it when the diff warrants it, not by default.
