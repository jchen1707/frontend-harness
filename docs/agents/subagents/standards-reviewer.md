# Standards checklist — frontend-harness

The stack half of the shared `standards-reviewer` frame. The frame carries the method and the
reporting rules; this is what "the standards that apply to every change" means here.

A checklist of what to look for, **not the authority**. Where this and `docs/architecture.md`
disagree, the source wins — reread it rather than trusting the summary.

- **The fractal dependency rule** — inside one feature slice, `ui` → `services` →
  `repositories` → `core`. Dependencies point one way. A repository importing a hook, a
  component calling `fetch` directly, or a service reaching into another feature's internals
  is a violation. Cross-feature imports go through that feature's `index.ts` and nothing else.
- **`core/` and `env.ts` sit at the bottom** — every layer may import them; they import
  nothing above.
- **Zod at every boundary** — API responses, form input, URL params, anything crossing into
  the app from outside. A response typed with `as` instead of parsed is a violation.
- **Server state is TanStack Query or Apollo, never `useState` + `useEffect`** — a
  hand-rolled fetch-and-store is a violation whatever it is named.
- **Config only through `src/env.ts`** — any bare `import.meta.env` outside that module is a
  violation, and a secret behind a `VITE_` prefix is a serious one: those are bundled and
  public.
- **`core/logger.ts`, never `console.*`** — and let errors surface with their cause rather
  than being swallowed by an empty `catch`.
- **Explicit types on every exported function**, no `any`, no unchecked `as`.

## Where the gate cannot see

`eslint-plugin-boundaries` machine-enforces the dependency rule, so a layering violation in a
classified file should already be failing `pnpm lint`. **It fails open.** A file under `src/`
that no element pattern in `eslint.config.js` matches is simply unchecked, and the rule reads
as green.

So if you find a layering violation the linter did not, the finding is about the **ESLint
config**, not the file. Say that — a rule that passes vacuously is worse than a missing rule,
because everyone believes it.
