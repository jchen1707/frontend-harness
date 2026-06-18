---
description: Context and memory hygiene audit
---

Audit the working context and durable memory:

1. **Assess context size.** Summarize what's still relevant to the current task versus what
   can be dropped. Flag files that were re-read unnecessarily.
2. **Check CLAUDE.md vs. memory** for staleness or duplication.
3. **Propose memory entries** for durable facts worth keeping across sessions — typed
   `user` / `feedback` / `project` / `reference` — in
   `~/.claude/projects/<slug>/memory/`, with a one-line pointer in `MEMORY.md`.
4. **Suggest `/retro`** for any bug or tool friction whose lesson isn't already captured.

Don't save what the repo already records (code structure, git history, CLAUDE.md).
