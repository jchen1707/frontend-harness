# Planning — this repo

<!-- harness:agnostic -->

**Shared doctrine lives in `.agents/vendor/harness/commands/plan.md` and
`implement-from-plan.md`** — the two-terminal protocol, the branch setup, the sign-off
checkpoint, the deviations rule. It is vendored from
[`harness`](https://github.com/jchen1707/harness) and pinned by sha; read it first.

<!-- /harness:agnostic -->
<!-- harness:claude
**Shared doctrine is provided by the `harness` plugin**, as `/plan` and
`/implement-from-plan` — the two-terminal protocol, the branch setup, the sign-off
checkpoint, the deviations rule. Read them first.
/harness:claude -->

This file records only what is true in **this** repo.

## What a design has to state explicitly

`/plan` step 4 requires all of these before sign-off. A plan missing one hands terminal 2 a
decision it will make silently and differently.

- **Which feature slice** this belongs in — an existing `src/features/<name>/`, or a new one.
  A new slice needs its `ui/`, `services/`, `repositories/` and `index.ts` named up front.
  Read `src/features/AGENTS.md`.
- **The layer placement** of each piece, and the repository interface plus the fake the tests
  will use.
- **The data-fetching choice** — REST via TanStack Query, or GraphQL via Apollo — and the Zod
  schemas at the boundary.
- **The pattern for the feature, explicitly chosen and justified.** `docs/architecture.md` §0.
- **What the slice publishes** through `index.ts`, and what stays internal.
- **The visual design direction, when the work adds or reshapes user-visible UI.** Load the
  `frontend-design` skill and run its brainstorm-and-critique pass against this feature's real
  subject and content. Three repo rules bind its output:
  - every colour and type value lands as a token in `tailwind.config.js`, never as an
    arbitrary value;
  - a new typeface is a dependency decision (§14) with a §12 performance cost — justify it or
    stay with the stack;
  - its screenshot self-critique needs explicit image-input consent. Default to
    `take_snapshot` and the user's own eyes.

  Skip this for work with no visual surface.

- **Rendering, routing, SEO and performance implications**, and accessibility for any new
  interaction.

The plan carries a **Design direction** section when that last bullet applies: the palette as
named tokens, the type roles, the layout concept in one sentence or an ASCII wireframe, and
the one signature element. Terminal 2 follows it instead of re-deriving taste mid-build.

## Where code lands

A slice, not a folder of its kind. `src/features/<slice>/` under the right layer, with
cross-feature reuse going through the other slice's `index.ts` — or promoted to `src/core` or
`src/components/ui` deliberately. Read `src/features/AGENTS.md` before the first edit.

## Test tiers, for the test plan

- Beside the code, inside the slice — the default `pnpm test` run, offline, MSW intercepting
  every request.
- `e2e/` — Playwright journeys. Reach for one only when the browser is the point: real
  navigation, real layout, focus across a page load.

## Before a PR

Run `/preflight`. It checks the process gates the code gates cannot see — body, tracker, test
coverage of the diff, plan status — and produces the Evidence scorecard. The body follows
`.github/PULL_REQUEST_TEMPLATE.md`, and CI enforces that it is not empty (`pr-template.yml`).
