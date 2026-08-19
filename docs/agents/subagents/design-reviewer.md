# Design checklist — frontend-harness

The stack half of the shared `design-reviewer` frame. The frame carries the depth vocabulary
and the requirement to name a concrete cost; this is what the boundaries actually are here.

## The boundaries this repo has committed to

The feature slice is the unit. Inside one: `ui` → `services` → `repositories` → `core`.
Across slices: **`index.ts` is the contract**, and nothing else is public. That single file is
the most consequential design decision in any slice, and most design findings here are about
it.

## Shapes that recur here

- **Shallow components and hooks.** Twelve props to render one row; a hook returning eight
  values the caller must reassemble. Depth is a small interface hiding real work.
- **Leaky abstractions.** A `useX` hook whose caller must know it wraps TanStack Query to use
  it correctly. A repository that returns the raw transport shape and makes every caller
  reshape it. A component that only works if its parent sets a particular CSS context.
- **Seams in the wrong place.** The test is whether one logical change hits both sides. If
  adding a field means editing the schema, the repository, the hook, the component and the
  story, the seams cut across the change rather than along it.
- **Prop drilling versus context versus composition.** Three levels of pass-through props
  signals the boundary is wrong. So does context used for something only two components share.
- **Temporal decomposition.** A slice split into `loadThing` / `formatThing` / `showThing`
  because that is the order things happen, rather than by what each one knows.
- **The same decision encoded twice.** A default in the schema and again in the component. A
  status string parsed in the repository and re-parsed in the UI. Two copies of one decision
  drift silently.
- **What `index.ts` publishes.** Exporting internals makes every internal a public API;
  exporting too little forces the next caller to reach around it.

`docs/architecture.md` §0 requires a pattern to be chosen and justified per feature. A design
finding that contradicts a recorded choice is a finding about the record — say so rather than
relitigating it in a review.
