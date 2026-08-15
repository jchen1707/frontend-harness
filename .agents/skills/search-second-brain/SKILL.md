---
name: search-second-brain
description: Search the second brain for prior learnings on a topic and report the patterns across them, not just the hits. Use before designing something the notes may already have opinions about, when a problem feels familiar, or when a decision needs prior art.
argument-hint: '[topic, question, or error message]'
---

Search the user's personal knowledge base for what past sessions already learned, and report
**the pattern across the notes** — not a list of files.

The topic is `$ARGUMENTS`. If empty, ask what to look for rather than dumping the directory.

## Where to look

The notes live outside this workspace, so read them with **absolute paths**. The vault root
is `$OBSIDIAN_VAULT_DIRECTORY`. Learnings live in its `Project Learnings` directory. In
PowerShell, use `$env:OBSIDIAN_VAULT_DIRECTORY`.

Two generated indexes sit above the notes. Both are cheap; read them before anything else:

| Index                          | Covers                           | Columns                    |
| ------------------------------ | -------------------------------- | -------------------------- |
| `_VAULT_INDEX.md` (vault root) | **every** note in the vault      | path, tags, what it covers |
| `Project Learnings/_INDEX.md`  | the auto-distilled session notes | date, project, summary     |

- The wider vault is where most of the value is — hand-written notes are usually more
  considered than anything auto-distilled. `_VAULT_INDEX.md` is what makes them findable
  without opening them.
- Learnings written by the `SessionEnd` hook live in `Project Learnings`. Each has
  `tags: [project-learnings, session-retro]` and two sections — _Implementation learnings_
  and _Architecture & design learnings_.

> **Expect both indexes to lag, and never treat them as complete.** This repo writes notes
> but does not index them — `python-harness` owns both files and rebuilds them when a session
> ends there. So every note written from a frontend session since the last `python-harness`
> session is missing from the indexes, including notes you can plainly see in the folder.
> The grep in step 2 is what covers that gap. It is not optional here.

An `.base` file (`LLM.base`) is **not** an index you can read. It is a query that Obsidian
evaluates in its own UI; reading it returns the query definition, never any notes. It is
there for the human. The Markdown indexes above are the ones for you.

If the variable is unset, say so and stop. Do not guess a path.

**Never write to the vault from this skill.** It reads. The hook writes. Keeping those apart
is what stops a search from quietly editing the thing it was searching.

## Method

1. **Read `_VAULT_INDEX.md` first. Always.** One row per note across the whole vault — path,
   tags, and a line on what it covers. It is the cheapest read available and it tells you
   which notes are worth opening before you spend a token on any of them. Add
   `Project Learnings/_INDEX.md` when the question is about a past session specifically; it
   adds the date and originating project.

   Both are rebuilt when a session ends in `python-harness`, so they are current to that
   session, not to this one. A note added in Obsidian since then will be missing — which
   is why step 2 still greps rather than trusting the index alone.

   A blank "what it covers" means the note is an empty stub, not that it is unreadable. Do
   not open it hoping for content.

   Never read every note to answer one question. That cost is exactly what the indexes exist
   to avoid, and it grows with every session.

2. **Search wide before reading deep.** `Grep` the whole vault for the topic and for its
   obvious synonyms — the notes were written in the language of the moment, not yours. An
   error message is best matched on its distinctive fragment, not the whole string.

   Use this to catch what the summaries do not say. A summary names topics; the body holds
   the detail. Search both, but open bodies selectively.

   **Never skip this step because step 1 returned hits.** In this repo the indexes are
   written elsewhere and always lag, so an unindexed note is the normal case, not the edge
   case. Skipping the grep turns "the vault has nothing on this" into a confident falsehood.

3. **Read the hits in full.** These notes are short. Skimming a lesson is how you get the
   correction backwards.
4. **Prefer the specific over the recent.** A note that names the exact tool or failure beats
   a newer one that gestures at the area.
5. **Check the repo too.** `AGENTS.md`, `docs/architecture.md`, the nested `AGENTS.md` files
   and `docs/agents/` may already encode what a note only observed. Where they agree, say so
   — a lesson that made it into a standard is settled. Where they conflict, that is the most
   interesting finding you can return, and you should say which is newer.

## What to report

Lead with the **pattern**, then the evidence:

- **What the notes already establish** — the recurring lesson, stated once, in your own words.
  If three notes circle the same mistake, that is one finding with three citations, not three
  findings.
- **Where they disagree, or where a later note revised an earlier one.** Say which is newer
  and what changed.
- **What is settled vs. still open** — a lesson promoted into `AGENTS.md` or
  `docs/architecture.md` is settled. One that lives only in a note is an observation that has
  not yet earned a rule.
- **What the notes do _not_ cover.** Say it plainly. A confident answer assembled from notes
  that never addressed the question is the failure mode this skill exists to avoid.

Cite each note by filename and quote the line you are relying on. The user should be able to
check you without re-searching.

## When a note you expected is missing

A session that should have produced a note but did not is a diagnosable event, not a
mystery. Read `_hook.log` in `Project Learnings` — the SessionEnd hook appends one line
per run: `wrote`, `skipped`, `no learnings`, or `failed:` with the reason. No line at all for
the session means SessionEnd never fired; a closed terminal window skips it. Report which
case it was rather than guessing.

## When the search comes up empty

Say so in one line and stop. Do not reconstruct an answer from general knowledge and present
it as if it came from the vault — the entire value here is that these are _the user's own_
hard-won conclusions, and blurring that makes the second brain untrustworthy.

Offer the alternative instead: answer from first principles, clearly labelled as such.

## Why the indexer lives in one repo only

Read this before you propose fixing the lag by adding an indexer here. Do not add one.

An indexer in both repos is one artifact with two writers. This repo shipped a port of
`vault_index.py` for exactly one day. In that time the pair re-diverged on a header line
inside a single fix cycle — with only one side under test, because neither repo's suite can
see the other's output. Tests can pin a contract between two implementations. They cannot
stop the two from disagreeing about what a description should say. Deleting the second
implementation removes the failure mode instead of guarding it.

So the cost is stated plainly: notes written from this repo do not appear in either index
until a session ends in `python-harness`. The grep in step 2 is what makes that a degraded
search rather than a silently truncated one. If a stretch of frontend-only work has made the
index old, run the indexer in `python-harness`.

## Escalating a pattern

When a lesson recurs across several sessions, it has outgrown the vault. Propose promoting it
— a repeatable procedure becomes a command in `.claude/commands/`; a durable standard becomes
an edit to `AGENTS.md`, `docs/architecture.md`, or the nested `AGENTS.md` for the layer it
governs. Propose and confirm; do not apply it unasked. Mirrors what `/retro` does for
memories.
