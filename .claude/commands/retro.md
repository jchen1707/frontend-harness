---
description: Capture lessons from friction into durable memory
---

Run a retrospective on friction hit during this session and write durable **lessons** to the
memory store so the same trap is avoided next time. "Friction" means: a bug that took real
effort to diagnose, an approach that failed before the one that worked, or difficulty using a
tool — wrong flags, Windows/PowerShell quirks, env or setup gotchas, an API used wrongly, or
a command that didn't do what its name implied.

The argument optionally names a specific lesson to capture; if empty, scan the session for
any: `$ARGUMENTS`.

For each durable, non-obvious lesson:

1. **Decide if it's worth saving.** Keep only what would have saved real time had you known
   it up front. Skip anything the repo already records (code, git history, `CLAUDE.md`,
   `docs/architecture.md`, the nested `CLAUDE.md` files) or that mattered only to this task.
2. **Check for an existing memory** first — scan `MEMORY.md`. Update that file rather than
   duplicating it; delete one that turns out to be wrong.
3. **Write the lesson** to `~/.claude/projects/<slug>/memory/` as one file with frontmatter
   (`name`, `description`, `metadata.type`), then add a one-line pointer to `MEMORY.md`.
   - `name`: `lesson-<short-kebab-slug>`.
   - `type`: `feedback` for a "how to work here" lesson; `reference` for an environment, tool
     or external-API gotcha.
   - Body: the symptom and what actually worked. For `feedback`, follow with **Why:** (the
     root cause) and **How to apply:** (the concrete thing to do next time). Link related
     memories with `[[name]]`.
4. **Escalate if it's recurring or procedural.** A one-off fact stays a memory. But if the
   lesson is a repeatable procedure or a standard everyone working here should follow, propose
   promoting it:
   - a repeatable workflow → a new command in `.claude/commands/` or skill in
     `.claude/skills/`;
   - a durable standard → an edit to `CLAUDE.md`, `docs/architecture.md`, or the nested
     `CLAUDE.md` for the layer it governs;
   - a review blind spot → a new axis in `.claude/agents/` plus an entry in
     `.claude/workflows/full-review.js`.
     Memories are cheap and reversible — write them directly. Promotions are more invasive:
     propose and confirm before applying.

Note the division of labour. This command writes **project memory**. The SessionEnd hook
writes the **second brain** — transferable lessons, in the user's own vault — on its own, with
no prompting. Do not duplicate a lesson into both: if it is about this project, it is a
memory; if it would help on an unrelated codebase, it belongs in the vault.

**The hook is not guaranteed to run.** It fires only when the session ends cleanly — a closed
terminal window skips it — and it can fail after firing (`_hook.log` beside the notes records
every outcome). So when this retro surfaces a lesson that is clearly **transferable** and
losing it would hurt, do not just "let the hook have it":

1. Check `$CLAUDE_LEARNINGS_DIR` is set. If unset, say so; there is no vault to write.
2. Ask the user whether to write the vault note now. If yes, write one Markdown file to
   `$CLAUDE_LEARNINGS_DIR` in the hook's note format — frontmatter (`date`, `project`,
   `session`, `summary`, `tags: [project-learnings, session-retro]`), then
   `## Implementation learnings` and/or `## Architecture & design learnings`.
3. Never touch `_VAULT_INDEX.md` or `_INDEX.md` — `python-harness` owns the indexes.

A note written here and a note the hook writes later do not collide — the hook's filename
carries the session id. Duplicated content is cheap; a lost lesson is not.

Report what you captured and any promotion you propose. `/context` flags friction you haven't
captured yet.
