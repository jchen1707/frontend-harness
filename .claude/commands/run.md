---
description: Start the dev server (and optionally verify in a browser)
---

Start the Vite dev server:

```bash
pnpm dev
```

- Run `pnpm install` first if dependencies changed.
- Report the URL (http://localhost:5173) and confirm the Home route renders.

To verify interactively, you may use the **Playwright MCP** server to navigate and read
the page's accessibility snapshot (text — no consent needed).

> **Image-input consent (hard rule):** taking a screenshot (e.g. Playwright MCP
> `browser_take_screenshot`) feeds an image into the model. **Stop and explicitly ask the
> user for permission before any screenshot**, and do not proceed until they confirm.
> Prefer the text accessibility snapshot, which needs no consent.
