# frontend-development-harness

The domain glossary for the application built in this harness. It defines the words, not the
implementation. Standards live in `docs/architecture.md`; the layering rules live in the nested
`CLAUDE.md` files.

`docs/agents/domain.md` records the harness-level ambiguities this repo has already resolved
("agent", "component", "service"). This file covers the application domain.

## Language

**Project**:
The object a user owns and works in. Every later screen (detail, members, settings) hangs off
one.
_Avoid_: workspace, board, space.

Unqualified "Project" in `src/`, in tickets and in commits means this entity. Two other senses
exist in this repo and both need their qualifier every time:

- **Linear project** — the `project` field on a Linear issue. Always write both words.
- **project slug** — the directory name Claude Code uses under `~/.claude/projects/`. Never
  just "project".

**Status**:
The lifecycle of one Project, as a single value: `active`, `paused` or `archived`. A Project
has exactly one Status.
_Avoid_: state, phase, stage.

**Archived**:
The Status of a Project that is put away. A list of Projects excludes archived Projects unless
the reader asks for them.
_Avoid_: deleted, hidden, closed.

**Owner**:
The single User accountable for a Project. A Project references its Owner by id and name, never
by name alone.
_Avoid_: creator, author, assignee, lead.

**Last updated**:
The moment the Project record last changed. It does not track activity inside the Project, so
renaming a Project changes it and commenting in one does not.
_Avoid_: modified, touched, last activity.
