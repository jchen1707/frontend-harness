# `src/components/` — shared UI primitives

The design system. Presentational primitives every feature may use: buttons, inputs, dialogs,
layout, typography. Sits at the bottom of the graph with `core` — it may import `core` and
`env`, and nothing above.

## What belongs here

A component earns a place here when it is **presentational and feature-agnostic**. The test:
could a second, unrelated feature use it without changing it?

- `Button`, `Input`, `Dialog`, `Card`, `Spinner` — yes.
- `HealthBadge`, `InvoiceRow`, `SearchFilters` — no. Those know a domain; they belong in
  their slice's `ui/`.

Moving a component here is a **promotion**, made deliberately when a second feature needs it —
not pre-emptively because it looks reusable. A primitive with one consumer is indirection.

## Rules

1. **No data access.** No `fetch`, no `useQuery`, no repository imports. A primitive that
   fetches cannot be reused, because its data needs travel with it.
2. **No feature imports.** Enforced by `eslint-plugin-boundaries`, and the reason is
   structural: a primitive importing a slice inverts the graph and makes the design system
   depend on the app.
3. **Props in, events out.** State that outlives one interaction belongs to the caller.
   Support the controlled form; add an uncontrolled convenience only if several callers want
   it.
4. **Semantic elements.** A `Button` renders `<button>`. Every re-implementation of a native
   control has to re-implement its keyboard behaviour, its focus ring and its form
   participation, and almost none of them do. See `docs/architecture.md` §11.
5. **Forward the escape hatches.** Accept `className`, spread the remaining native props, and
   forward the `ref`. A primitive that swallows them forces every caller to wrap it.
6. **Tailwind tokens, not arbitrary values.** Compose from `tailwind.config.js`; `w-[437px]`
   in a shared primitive is a magic number every consumer inherits.

## Accessible by construction

A defect here is multiplied by every consumer, so the accessibility work happens once, at this
level:

- An accessible name on every interactive element, including icon-only ones.
- Full keyboard operation, and a visible focus indicator that is not removed.
- ARIA state that tracks visual state (`aria-expanded`, `aria-invalid`, `aria-busy`).
- Focus moved into an overlay on open and returned to the trigger on close.
- Contrast at WCAG AA in every variant, including disabled and hover.

## The public surface

`src/components/ui/index.ts` is what the app imports. Export the component, its props type,
and any variant type a caller must name. Keep internals unexported — an internal that leaks
becomes an API you cannot change.
