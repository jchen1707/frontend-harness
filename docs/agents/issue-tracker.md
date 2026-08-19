# Issue tracker: Linear — this repo

<!-- harness:agnostic -->

**Shared doctrine lives in `.agents/vendor/harness/docs/agents/issue-tracker.md`** —
connecting, tool discovery, the operation table, status sync, wayfinding, the AI-authorship
disclaimer and the spec-correction procedure. It is vendored from
[`harness`](https://github.com/jchen1707/harness) and pinned by sha; read it first.

<!-- /harness:agnostic -->
<!-- harness:claude
**Shared doctrine is provided by the `harness` plugin**, at
`${CLAUDE_PLUGIN_ROOT}/docs/agents/issue-tracker.md` — connecting, tool discovery, the
operation table, status sync, wayfinding, the AI-authorship disclaimer and the
spec-correction procedure. Read it first.
/harness:claude -->

This file records only what is true in **this** repo.

## Workspace and team

|                    | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Workspace          | **Development** (`development-jchen`)                         |
| Team for this repo | **Frontend**, key **`FRO`** — issues read `FRO-123`           |
| Sibling team       | **Backend**, key `BAC` — `python-harness` files there, not us |

Name branches `<type>/FRO-<num>-<slug>` (e.g. `feat/FRO-412-search-filters`). The Spec axis
of a review resolves the ticket from that prefix, so a branch named with the wrong one
silently loses the axis. When there is no ticket, it falls back to `.agents/plans/plan.md`.

`#42` in this repo's conversation usually means a GitHub PR, not a Linear id.

## Repo-specific notes

- The **Standards** axis of `/code-review` reads `docs/architecture.md` (authoritative), the
  summary in `AGENTS.md`, and the nested `AGENTS.md` for whichever directory the diff
  touches. Those override the skill's generic smell baseline.
- Definition of Done lives in `AGENTS.md`; the `verify` skill runs those gates and prints
  evidence.
- Nine axes instead of two: `.claude/workflows/full-review.js`, run with `/workflows`. That
  is real spend — reach for it when the diff warrants it, not by default.
