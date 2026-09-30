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

## Both indexes are rebuilt by shared code

`session_learnings.mjs` and `vault_index.mjs` are layer A. They run from
`.agents/vendor/harness/hooks/`.

| Index                          | Covers                                | Rebuilt                                              |
| ------------------------------ | ------------------------------------- | ---------------------------------------------------- |
| `_VAULT_INDEX.md` (vault root) | every note in the vault               | every eligible session end with the vault configured |
| `Project Learnings/_INDEX.md`  | the auto-distilled session notes only | each session that writes a note                      |

The shared hook rebuilds both indexes after it processes an eligible session. The former
cross-repository indexing lag is gone.

`distil_backlog.mjs` recovers sessions that did not fire `SessionEnd`. It uses the same
shared index code.

Never write either index file by hand.
