# Second brain — this repo

<!-- harness:agnostic -->

**Shared doctrine lives in `.agents/vendor/harness/skills/search-second-brain/SKILL.md`** —
how to search, what to report, and why there is one indexer rather than one per repository.
It is vendored from [`harness`](https://github.com/jchen1707/harness) and pinned by sha; read
it first.

<!-- /harness:agnostic -->
<!-- harness:claude
**Shared doctrine is provided by the `harness` plugin**, as the `search-second-brain` skill —
how to search, what to report, and why there is one indexer rather than one per repository.
Read it first.
/harness:claude -->

This file records only what is true in **this** repo.

## Session-end indexing

The shared SessionEnd hook writes the session note and rebuilds `_VAULT_INDEX.md` in every
repository. When it writes a note, it also rebuilds `Project Learnings/_INDEX.md`.

One layer-A implementation owns these indexes. Do not add a local indexer or edit either
index file by hand.
