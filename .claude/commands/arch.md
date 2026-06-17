---
description: Load and summarize the architecture standards
---

Read `docs/architecture.md` now.

Then summarize, in 5–8 bullets, the standards most relevant to the current task:
layering (UI → service → repository), interfaces over implementations, data fetching
(REST via TanStack Query, GraphQL via Apollo) with Zod boundary validation, config/env
rules, types (strict, no `any`), testing (offline unit + Playwright E2E), and the
approved stack.

If the user has described a change, flag any part of it that would violate a standard
(especially a stack change or a layer-boundary crossing) **before** any implementation.
