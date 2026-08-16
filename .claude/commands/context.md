---
description: Context and memory hygiene audit
---

Audit the working context and the three tiers of durable knowledge. Report findings; do not
write memory or compact without confirmation.

1. **Assess context size.** Summarize what's still relevant to the current task versus what
   can be dropped. Flag files that were re-read unnecessarily, or read in full when the `LSP`
   tool would have answered the question for nothing.
2. **Check the rule files for staleness or duplication** — `AGENTS.md`,
   `docs/architecture.md`, and the nested `AGENTS.md` under `src/` and `e2e/`. A rule stated
   twice is a rule that will disagree with itself. For a full pass, run `/prune-rules`.
3. **Propose memory entries** for durable facts worth keeping across sessions — typed
   `user` / `feedback` / `project` / `reference` — in
   `~/.claude/projects/<slug>/memory/`, with a one-line pointer in `MEMORY.md`.
4. **Check the tier.** Three exist and they are not interchangeable:
   - **memory** — facts about _this project_ that the repo does not record;
   - **second brain** (`/search-second-brain`) — transferable lessons across projects, written
     by the SessionEnd hook;
   - **`AGENTS.md` / `docs/architecture.md` / the nested `AGENTS.md`** — what has hardened
     into a rule.
     Name anything sitting in the wrong tier, and anything that has recurred often enough to
     be promoted up.
5. **Suggest `/retro`** for any bug or tool friction whose lesson isn't already captured.

Don't save what the repo already records (code structure, git history, `AGENTS.md`).
