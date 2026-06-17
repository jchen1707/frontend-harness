---
description: Lint, format-check, and type-check
---

Run the three gates and report results:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
```

- Run `pnpm install` first if dependencies changed.
- Report every violation verbatim.
- Fix only what your change introduced — don't reformat unrelated code.
- Per the Definition of Done, all three must be clean before work is "done".
