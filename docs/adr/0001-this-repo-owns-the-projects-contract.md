# This repo owns the Projects API contract

No backend serves Projects. The sibling `python-harness` is also a harness, with no application
code and no Projects resource, so FRO-1 had no API to read from. We decided this repo defines
the contract: the Zod schema in the `projects` slice is the source of truth, MSW implements it
for tests and for development, and a backend later implements the same shape.

## Considered options

- **Wait for `python-harness`.** Rejected. That repo has no application code at all, so FRO-1
  would depend on unscoped work with no date.
- **Fixtures only, no HTTP path.** Rejected. It skips the repository and Zod boundary, which is
  the part of the stack this harness exists to demonstrate, and it leaves that boundary
  untested.

## Consequences

- The frontend schema is authoritative until a backend exists. A backend that returns a
  different shape is a defect in the backend, not in the client.
- MSW gains a second job. It was test-only through `setupServer`; it now also runs as a browser
  worker in development, behind `VITE_MOCK_API`, which defaults to off so a fresh clone stays
  quiet.
- The list endpoint returns an envelope, `{ "projects": [...] }`, not a bare array. This lets
  pagination fields arrive later without a breaking change. See ADR 0002.
- `vite-plugin-pwa` is disabled in `vite.config.ts` today, so the MSW worker has the service
  worker scope to itself. Enabling the PWA means resolving that overlap first.
