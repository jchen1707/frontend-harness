---
description: Start the dev server (and optionally verify in a browser)
---

Start the Vite dev server:

```bash
pnpm dev
```

- Run `pnpm install` first if dependencies changed.
- Report the URL (http://localhost:5173) and confirm the Home route renders.

To verify interactively, drive the app with the **Chrome DevTools MCP** server:
`navigate_page`, then `take_snapshot` to read the page as a text a11y tree — roles, names and
state, which is a better assertion target than a picture and needs no consent. `click`,
`fill` and `fill_form` exercise it; `list_console_messages` and the network tools explain it
when something misbehaves.

This is the fast loop: it costs tokens per run and asserts nothing. When you settle on
behaviour worth keeping, write it into `e2e/` as a Playwright spec — that is what will still
be checking it in six months.

> **Image-input consent (hard rule):** a screenshot (`take_screenshot`) or a screencast feeds
> an image into the model. **Stop and explicitly ask the user for permission first**, and do
> not proceed until they confirm. Prefer `take_snapshot`, which needs no consent.
