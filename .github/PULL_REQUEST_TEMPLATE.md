<!-- A PR with an empty body is not done (AGENTS.md, Definition of Done). Fill every
section. Write in Simplified Technical English. -->

## Summary

<!-- One paragraph: what this PR delivers and why. Include the magic words
"Fixes FRO-123" on their own line — Linear's GitHub integration reads them to move the
issue to In Review on open and Done on merge. -->

## What changed

<!-- The changes a reviewer must know about, grouped by area. Not a file list — git has
that. Name the decisions: new slice, new interface, promoted component, changed contract. -->

## How to demo

<!-- Exact commands and the route to open. The reviewer must not guess.
Example:
```sh
$env:VITE_MOCK_API = "true"; pnpm dev   # PowerShell
```
Then open http://localhost:5173/... -->

## Evidence

<!-- Paste the real gate results, not an assertion that they passed:
lint, format:check, typecheck, test, build; test:e2e when UI behaviour changed.
Name any gate that did not run, with the reason. -->

## Screenshots or snapshot

<!-- Required for user-visible changes. A screenshot needs the user's image-input consent
(AGENTS.md, Guardrails); a text a11y-tree snapshot from `take_snapshot` is the accepted
no-consent alternative — paste the relevant landmarks and roles. If neither is present,
say why. -->

## Risks and follow-ups

<!-- What could break, what is deliberately out of scope, and the ticket that owns it. -->
