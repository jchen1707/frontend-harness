# The Projects list fetches every row and filters on the client

FRO-1 requires the list to filter as the user types, to send fewer than one request per
keystroke, and to stay smooth at 500 projects. We decided the list reads all Projects in one
request, then filters and sorts them in the browser. This sends zero requests per keystroke
instead of a debounced few, and it removes server-side filtering from the contract.

## Considered options

- **Server-side pagination**, through `useInfiniteQuery` or page numbers. Rejected for now. 500
  rows is approximately 50 KB of JSON, so paging adds contract surface and request latency for
  no measurable gain.

## Consequences

- **This holds to low thousands of rows.** A backend that must serve 100,000 Projects
  invalidates the decision. Reopen this ADR at that point; do not extend the client filter.
- The response envelope from ADR 0001 keeps the migration open. Cursor or page fields can join
  the envelope without breaking existing clients.
- The list needs no virtualization. 500 rows is approximately 2,500 DOM nodes, and virtualizing
  a table breaks row traversal for keyboard and screen reader users.
- Search text and status live in the URL as search params, because the client holds the full
  data set and can restore any filtered view from the URL alone.
