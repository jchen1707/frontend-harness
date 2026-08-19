# Loop goals — this repo

<!-- harness:agnostic -->

**Shared doctrine lives in `.agents/vendor/harness/skills/loop-goal/SKILL.md`** — the
protocol, the guardrails, the four goals that hold anywhere. It is vendored from
[`harness`](https://github.com/jchen1707/harness) and pinned by sha; read it first.

<!-- /harness:agnostic -->
<!-- harness:claude
**Shared doctrine is provided by the `harness` plugin**, as the `loop-goal` skill — the
protocol, the guardrails, the four goals that hold anywhere. Read it first.
/harness:claude -->

This file records only what is true in **this** repo.

## The four shared goals, sharpened

| Goal           | Stop condition here                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs`         | Every claim in `AGENTS.md`, `README.md`, `docs/architecture.md` and the nested `AGENTS.md` files matches the code; every documented command runs; no reference to a deleted file or command |
| `architecture` | `pnpm lint` green with no `boundaries/dependencies` violation, **and** every `src/**` file classified by an element pattern in `eslint.config.js` — no file passing the rule vacuously      |
| `tests`        | Every exported function and every rendered state in `src/` has at least one test exercising real behaviour; every case in the test plan is covered; `pnpm test` green                       |
| `deps`         | Every dependency in `package.json` is used; nothing used is missing; the approved-stack table in `AGENTS.md` matches what is installed                                                      |

Note what the `architecture` condition has to say twice. "The linter is green" is not the
condition, because `eslint-plugin-boundaries` fails open: a file no element pattern classifies
is unchecked, and the rule reads as green. The second clause is what makes the goal terminate
on the real state rather than on the gate's opinion of it.

## Goals only this repo has

| Goal   | Stop condition                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a11y` | Every interactive element in `src/` is reachable and operable by keyboard, has an accessible name, and exposes its state; every async result has a live region; `pnpm lint` green                                  |
| `perf` | `pnpm lhci` scores every category — **none reported `null`** — and meets every assertion in `lighthouserc.json` at `error` and `warn` level; every route is code split; no request waterfall on any initial render |

`perf` names the null explicitly for the same reason: the performance category currently
scores `null` because the pinned Lighthouse cannot trace against the installed Chrome, and a
loop that stops on a category it never measured has not met its condition.
