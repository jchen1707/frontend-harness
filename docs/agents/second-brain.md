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

## This repo writes notes. It does not index them.

`python-harness` owns `_VAULT_INDEX.md` and `Project Learnings/_INDEX.md`, and rebuilds them
when a session ends **there**.

So every note written from a frontend session since the last `python-harness` session is
missing from both indexes — including notes you can plainly see in the folder. **The shared
skill's grep step is not optional here.** Skipping it turns "the vault has nothing on this"
into a confident falsehood.

If a stretch of frontend-only work has made the index old, run the indexer in
`python-harness`.

## Do not fix this by adding an indexer here

This repo shipped a port of `vault_index.py` for exactly one day. In that time the pair
re-diverged on a header line inside a single fix cycle — with only one side under test,
because neither repo's suite can see the other's output. Tests can pin a contract between two
implementations; they cannot stop the two from disagreeing about what a description should
say.

The asymmetry closes when the writer and the indexer move into layer A, where there is one
implementation and no pair to diverge. Until then it is a stated cost, not an open bug.

Never write either index file by hand.
