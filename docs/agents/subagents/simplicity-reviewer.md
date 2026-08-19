# Simplicity checklist — frontend-harness

The stack half of the shared `simplicity-reviewer` frame. The frame carries what counts as a
cut and how to weigh one; this is what is mandated here and what the framework already does.

## Mandated, not speculative

A repository interface earns its keep in this repo by having a **fake in the tests**. One that
does is the documented design, not speculation — do not flag it. One that does not is
indirection with no payoff, and that is a finding.

Zod schemas at boundaries are mandated too. A schema that looks like a thin wrapper over a
type is the boundary `docs/architecture.md` asks for.

## What to look for here

- **Speculative abstraction.** A generic component with one call site, a config object with
  one shape, a hook parameterised for a case that does not exist. Cut it back to the concrete
  thing until a second caller appears.
- **State that could be derived.** A `useState` mirroring a prop, a `useEffect` that only
  copies one value into another, a memo of a value the render already had. Derived state is a
  bug surface: it can disagree with its source.
- **Effects doing work that belongs elsewhere.** `useEffect` fetching data TanStack Query or
  Apollo already handles, or synchronising with an external store by hand.
- **Duplication worth extracting** — the same three lines in four components. Say where the
  shared version belongs: `src/components/ui` for a primitive, the feature's own module
  otherwise.
- **Dead code.** An export nobody imports, an unreachable branch, a prop always passed the
  same value, a leftover flag.
- **Wrapper components that add nothing** — a component whose whole body is another component
  with the same props.

## Check the claim before you make it

"Nobody calls this" needs a search. Prefer the `LSP` tool's `findReferences` over grep: grep
cannot tell a call from a mention in a comment or a JSX string, and it is blind to re-exports
through a slice's `index.ts`. A cut proposed on a wrong assumption costs more than the
complexity it removes.
