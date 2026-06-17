---
description: Capture lessons from friction into durable memory
---

Retrospective on bugs, failed approaches, or tool friction that took real effort this session.

For each lesson:

1. **Decide if it's worth saving.** Skip anything the repo already records (code, git history,
   CLAUDE.md, docs/architecture.md).
2. **Check existing memory** — update an existing file rather than duplicating.
3. **Write it** to `~/.claude/projects/<slug>/memory/<name>.md` with frontmatter
   (`name`, `description`, `metadata.type` = user/feedback/project/reference). For
   feedback/project, include **Why:** and **How to apply:** lines.
4. **Add a one-line pointer** to `MEMORY.md`.
5. **Escalate if recurring or procedural** — propose a new slash command, a CLAUDE.md edit,
   or a `docs/architecture.md` edit so the lesson becomes a standard.
