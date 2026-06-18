---
description: Research and plan a feature (terminal 1 of the two-terminal workflow)
---

You are the **planning** model (terminal 1). Research and design — do **not** implement.

1. **Build a task list** for the planning work.
2. **Pick the base branch first.** `git fetch`, offer the user a base (usually `main`),
   check it out and pull, then create a feature branch.
3. **Understand.** Read the relevant code; run `/arch` for standards.
4. **Design.** Define the approach across layers (UI → Service → Repository), the
   repository interface(s) and their fake, the data-fetching choice (REST/TanStack Query
   vs GraphQL/Apollo) and Zod schemas, and **explicitly choose and justify the
   architectural / design pattern** for the feature (see docs/architecture.md §0).
   Address SSR/SSG/SEO and performance if relevant.
5. **Write `.claude/plans/plan.md`:** Goal · Context · Approach · numbered Steps ·
   Verification · Open questions.
6. **Write `.claude/plans/test-plan.md`:** Scope · offline unit/component tests ·
   E2E (Playwright) cases · edge cases · how to run.
7. **Get explicit user sign-off.** Required checkpoint — do not skip.
8. **STOP. Do NOT implement.** Tell the user to open terminal 2 and run `/implement`.

> If any task in this session would feed an image into the model (screenshot, mockup,
> diagram), stop and ask the user for permission first (see CLAUDE.md Guardrails).
