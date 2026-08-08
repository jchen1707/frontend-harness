---
description: Research + plan a feature (implementation plan + test plan), get user sign-off, then STOP for handoff (terminal 1, planning model)
---

Two-terminal workflow — **terminal 1 (planning model)**. Research and plan the work, write an
**implementation plan** and a **test plan**, get the user's explicit sign-off, then **STOP**.
Do NOT write application code or implement here — planning only.

The argument is the feature/task to plan: `$ARGUMENTS`.

1. **Build the planning task list** (`TaskCreate`): `Pick base branch & branch off` →
   `Understand` → `Design approach` → `Write plan.md` → `Write test-plan.md` →
   `Get user sign-off`. Work through them in order, marking each in_progress/complete.
2. **Pick the base branch & create the feature branch (do this FIRST, before research).** The
   feature must be built off the branch the user chooses — never assume the current branch,
   which may be stale.
   - Inspect what's available so the options are real, not guessed: `git fetch --all --prune`
     (best effort; note if offline), then `git branch` and `git branch -r`. Note the current
     branch and the default (`main`).
   - Ask the user which branch to build off, using `AskUserQuestion`. Offer `main` first as
     the recommended default, plus the current branch and any other obviously relevant
     local/remote branches.
   - Check out the chosen base and update it: `git checkout <base>` then `git pull` (use
     `git pull --ff-only` when the base tracks a remote). If the pull fails, STOP and tell the
     user — ask whether to proceed from the local state or fix it first; do not force or reset.
   - Create and switch to a new feature branch off it. Name it `<type>/<TEAM-NUM>-<slug>` when
     a Linear ticket exists (e.g. `feat/FRO-412-search-filters`) so `/code-review` can resolve
     the ticket mechanically; kebab-case from the feature argument otherwise. Confirm the name
     with the user.
   - `plan.md` / `test-plan.md` are gitignored, so switching branches does not disturb them.
     Do not commit anything here — this step only sets up the branch.
3. **Understand** — read the relevant existing code and `docs/architecture.md` (or `/arch`).
   Check whether prior sessions already have opinions: `/search-second-brain <topic>`. Note
   the slices, layers and files this work touches.
4. **Design approach** — decide:
   - **Which feature slice** this belongs in — an existing `src/features/<name>/`, or a new
     one. A new slice needs its `ui/`, `services/`, `repositories/` and `index.ts` named up
     front. Read `src/features/CLAUDE.md`.
   - **The layer placement** of each piece, and the repository interface(s) plus the fake the
     tests will use.
   - **The data-fetching choice** — REST via TanStack Query or GraphQL via Apollo — and the
     Zod schemas at the boundary.
   - **The architectural / design pattern for the feature, explicitly chosen and justified**
     (see `docs/architecture.md` §0).
   - **What the slice publishes** through `index.ts`, and what stays internal.
   - Rendering, routing, SEO and performance implications; accessibility for any new
     interaction; risks; the verification steps.
5. **Write the implementation plan** — overwrite `.claude/plans/plan.md` with:
   - **Goal** — what this change delivers.
   - **Context** — findings from step 3 (current state, constraints, files).
   - **Approach** — the design from step 4: slice, layer placement, interfaces, the pattern
     chosen and why, and the slice's public surface.
   - **Steps** — numbered, concrete, ordered implementation tasks; each names its file(s) and
     layer and is small enough to verify independently. Terminal 2 turns this list into its
     task list.
   - **Verification** — the gates to pass (CLAUDE.md Definition of Done: `pnpm lint`,
     `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; `pnpm test:e2e` when
     UI behaviour changed; `pnpm lhci` when performance is in scope), then `/code-review`.
   - **Open questions** — anything terminal 2 should confirm before/while implementing.
6. **Write the test plan** — overwrite `.claude/plans/test-plan.md` with:
   - **Scope** — the behaviours that must be covered (tie each back to a plan Step).
   - **Unit & component tests (offline)** — the cases per layer (repository / service / ui),
     the MSW handlers they need, and the fakes to use. No network — these are the default
     `pnpm test` run.
   - **E2E tests** — the Playwright journeys, or "none" with a one-line reason.
   - **Edge cases & failure modes** — validation errors, not-found, empty and loading states,
     limits/bounds, cancellation, keyboard-only operation.
   - **How to run** — the exact commands and which Definition-of-Done gates this covers.
7. **Get user sign-off (REQUIRED checkpoint — do not skip).** Present a concise summary of
   both files and explicitly ask the user to confirm, using `AskUserQuestion` (e.g. "Approve
   plan & test plan / Revise"). Revise and re-ask until the user approves. Do NOT proceed past
   this checkpoint on your own — even in autonomous mode, planning requires this explicit
   verification.
8. **STOP — do not implement.** After sign-off, mark the planning tasks complete and stop.
   Tell the user to open terminal 2 (implementation model) and run `/implement-from-plan`,
   which feeds `.claude/plans/plan.md` + `test-plan.md` to the `/implement` skill as its spec
   (that skill won't find them on its own).

`plan.md` and `test-plan.md` are gitignored — local handoff artifacts, not committed. Plan
mode's own auto-saved file uses a random slug name and isn't a reliable handoff, so this
command writes the stable `plan.md` / `test-plan.md` instead.

> If any task in this session would feed an image into the model (screenshot, mockup,
> diagram), stop and ask the user for permission first (see CLAUDE.md Guardrails).
