# frontend-harness

A **harness, not an application**: it defines _how_ to build here. Application code goes in
`src/` per `docs/architecture.md`. Workload: React SPA, REST and GraphQL clients, AI features
behind a server. Sibling of `python-harness` (backend), translated to the React/TypeScript
ecosystem.

## Commands

Everything runs through `pnpm`. Gates, in the order the `verify` skill runs them:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` needs a browser binary first: `pnpm exec playwright install chromium`.

`pnpm build` is a gate, not just a packaging step: only the build checks the browser target
(es2020), so a top-level `await` passes `typecheck` and still breaks the build.

`pnpm dev` starts Vite on http://localhost:5173. `pnpm build` type-checks and builds to
`dist/`. `pnpm lhci` runs the Lighthouse budgets against that build.

## The workflow

<!-- harness:agnostic -->

Use workflow stages, not product-specific command names:

<!-- /harness:agnostic -->
<!-- harness:claude
The stages every path runs through:
/harness:claude -->

```
discover → clarify → specify → split → implement → verify → review → deliver
```

<!-- harness:agnostic -->

Run the matching installed skill when one exists. Otherwise execute the stage directly from
the contract in [`.agents/skills/delivery/SKILL.md`](.agents/skills/delivery/SKILL.md). An
optional plugin may improve a stage, but its absence never blocks the workflow.

<!-- /harness:agnostic -->
<!-- harness:claude
Ticket-shaped work runs the main flow, in one unbroken context:

```
/grill-with-docs  →  /to-spec  →  /to-tickets  →  /implement  →  /code-review
```

Those five are plugin skills marked `disable-model-invocation`: they do not appear in the
agent's skill listing and only the user can run them (`/mattpocock-skills:<name>`). Absence
from the listing means user-invocable, not missing — do not report them as nonexistent.
Small work uses `/plan` → (new terminal) → `/implement-from-plan` instead.
/harness:claude -->

Keep discovery through splitting in one context. Record the result in
`.agents/plans/plan.md` and `.agents/plans/test-plan.md`. Use a fresh context for each ticket
when the harness supports it. A single agent may execute the same stages sequentially when it
does not.

Small work can start at clarify or implement. Ticket-shaped work starts at discovery. Every
path ends with the repository gates and independent Standards and Spec review. Committing to
a feature branch and opening a PR needs no permission; committing to `main` does.

On GitHub, adding the `agent-review` label to a PR triggers one CI review pass on the Spec
and Standards axes (`.github/workflows/agent-review.yml`). It is label-gated because it is
billed spend, and it needs the `ANTHROPIC_API_KEY` repository secret.

### Where visual design runs

Visual direction is chosen **once, at alignment time**, and recorded — the same rule §0
applies to architecture. Who invokes the skill depends on the path:

| Path                                         | Invocation                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Small work                                   | Run an available design skill during planning and record **Design direction** in the plan.  |
| Ticket-shaped work                           | Run it after specification and before splitting so tickets inherit its acceptance criteria. |
| Ad-hoc restyling                             | Run it before editing and write chosen tokens in `tailwind.config.js`.                      |
| UI implementation with no recorded direction | The implementer defines and records a direction before the first component.                 |

Wherever it runs, the same three rules bind it: tokens in `tailwind.config.js` (no
arbitrary values), a new typeface is a §14 dependency decision, and screenshot
self-critique needs image-input consent.

### Definition of Done

- All six gate commands above pass (`test:e2e` when UI behaviour changed)
- New behaviour has a test that would fail if the behaviour regressed
- Standards review is clean; Spec review is clean when there is an originating ticket
- The PR body follows `.github/PULL_REQUEST_TEMPLATE.md` — a PR with an empty body is not
  done. Fill it from the plan and verification evidence already in hand
- The Linear issue tracks the work: **In Progress** when the branch starts, **In Review**
  with the PR attached when it opens — `docs/agents/issue-tracker.md` → Status sync
- Config and env read only through `src/env.ts`; no secret behind a `VITE_` prefix
- No stray `console.*` — log through `src/core/logger.ts`
- Friction worth remembering is captured in the harness memory mechanism when one exists

## What is enforced automatically

Git hooks and CI are the portable enforcement layer. Claude Code also runs the convenience
hooks in `.claude/hooks/`; other harnesses must not assume those hooks ran:

| Hook                                 | Effect                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protect_paths.mjs` (PreToolUse)     | Blocks edits to `.env`, `pnpm-lock.yaml`, `dist/`, generated output and `.husky/_/`. Also blocks **reading** `.env` / `.env.*`, permitting `.env.example`                     |
| `format_edited.mjs` (PostToolUse)    | Runs `prettier --write` on each edited file, plus `eslint --fix` on `.ts`/`.tsx`                                                                                              |
| `verify.mjs` (Stop)                  | Blocks the turn while the gates fail — **only** when the turn changed source under `src/`, `e2e/` or `.claude/hooks/`, or changed the root tool config                        |
| `session_learnings.mjs` (SessionEnd) | Distils the session's mistakes-and-fixes into a note in the second brain. Writes notes only — `python-harness` owns the indexes. Off unless `OBSIDIAN_VAULT_DIRECTORY` is set |

The Stop gate is what makes a session walk-away-able. `HARNESS_SKIP_VERIFY=1` disables it,
and the Claude-specific `CLAUDE_SKIP_VERIFY` is kept as a legacy alias. The harness overrides
a Stop hook after 8 consecutive blocks; if you hit that, the loop is stuck on something it
cannot fix.

Git-side, husky covers the actor the Stop hook cannot — a human, or a session that skipped
verify: pre-commit runs `lint-staged` + `typecheck`; pre-push runs `test` + `build`. A push
cannot reach CI with a broken build. `lint-staged` runs `secretlint` over **every** staged
file, so a commit carrying an API key fails before it exists. `pnpm scan:secrets` scans the
whole repo.

The gated set is _code the gates check, plus the config that defines them_ — so prose, plans
and docs still end freely and never burn override budget. Widen it by editing `GATED_PATHS` /
`GATED_FILES` in `verify.mjs`; `.claude/hooks/hooks.test.mjs` pins the pathspec, so dropping
an entry fails the suite rather than silently going quiet.

**One caveat the hooks cannot cover.** `eslint-plugin-boundaries` fails open: a file under
`src/` that no element pattern in `eslint.config.js` classifies is simply unchecked, and
`pnpm lint` still reports green. Inventing a new directory shape means adding its pattern in
the same change, or the architectural rule passes vacuously.

## Parallel development

<!-- harness:agnostic -->

Worktrees are the unit of isolation. Give each writing agent a separate worktree. If the
harness cannot guarantee isolation, keep file edits with one agent and use other agents only
for read-only research or review.

<!-- /harness:agnostic -->
<!-- harness:claude
Worktrees are the unit of isolation — separate checkouts mean parallel agents cannot collide
on files. `.claude/agents/test-writer.md` sets `isolation: worktree`; add it to any subagent
that writes. Claude Code blocks a worktree agent from redirecting git back into the main
checkout, so the isolation actually holds.
/harness:claude -->

**A reviewer is half a definition each way.** The shared **frame** — the role, the method,
the reporting rules — is layer A, identical in every stack. What "in this repo's terms" means
is this repo's, at `docs/agents/subagents/<agent-name>.md`. `full-review` concatenates the
two, and the standalone subagent reads the checklist itself, so the two forms cannot drift.

Neither half reviews on its own, and both failures are silent: a frame with no checklist
reviews on general advice and reports a confident clean.

- **Shared frames** — `.agents/vendor/harness/agents/` (the plugin, on `main`). Never edited
  here; edit them in [`harness`](https://github.com/jchen1707/harness) and re-sync.
- **This repo's half** — `docs/agents/subagents/`.
- **This repo's own agents** — `.claude/agents/`: `a11y-reviewer`, the ninth axis, and
  `test-writer`, which is here because it writes and so its tool grant names a runner.

Any harness may read and run those prompts; their frontmatter is only a Claude Code adapter.

Add an axis by writing the agent file and naming it in `harness.config.json`; there is no
second copy to keep in step.

**Fork for breadth, stay inline for depth.** Scanning and summarising belong in a subagent;
reasoning you need to steer belongs in the main context. Reviewers get read-only tools by
design — one that can edit will fix things instead of reporting them, and the independent
signal is the whole point.

## Loops and workflows

- **`loop-goal <goal>`** — run the repo-owned skill for standing goals (docs, architecture,
  a11y, tests, perf, deps). Progress lives in `.agents/plans/loop-<goal>.md`.
- **`full-review.js`** — layer A's dynamic workflow, fanning a diff out to nine independent
  reviewers and fanning in to one ranked report. Claude Code runs it through its workflow
  adapter; other harnesses use the `full-review` skill, which drives the same axes through
  their own agent tool. Reviews compare against `main` unless `REVIEW_BASE` says otherwise
  (`$env:REVIEW_BASE = "..."`). Nine agents is real spend — reach for Standards and Spec
  review by default and this when the diff warrants it.

  It reads `harness.config.json` for the ninth axis and for which tools already own style,
  and it **throws rather than falling back** when an axis resolves to no frame and no
  checklist. An axis reviewing on a one-line brief reports "no findings" from a reviewer that
  never ran, which is indistinguishable from a clean one.

## Symbol navigation (LSP) — prefer it when available

<!-- harness:agnostic -->

An **LSP tool** answers questions about symbols, where text search answers questions about
text. Use the harness LSP when available. Otherwise use `rg`, inspect definitions and
imports, and state that the result came from text search.

<!-- /harness:agnostic -->
<!-- harness:claude
The built-in **`LSP` tool** answers questions about **symbols**, where grep answers questions
about **text**. It is backed by `typescript-language-server`, registered through the
`typescript-lsp` plugin. It runs out of process and adds **no tokens** to a session.
/harness:claude -->

Use it when the question is semantic:

| Question                                | Operation                         |
| --------------------------------------- | --------------------------------- |
| Where is this defined?                  | `goToDefinition`                  |
| What uses this?                         | `findReferences`                  |
| What type is this, what does it accept? | `hover`                           |
| Where is this interface implemented?    | `goToImplementation`              |
| What is in this file?                   | `documentSymbol`                  |
| Where is a symbol I only know by name?  | `workspaceSymbol` (pass `query`)  |
| What calls this, or what does it call?  | `incomingCalls` / `outgoingCalls` |

Grep matches strings. It cannot tell a definition from a call, a component from a same-named
type, a real use from a mention in a comment or a JSX string, and it is blind to re-exports —
which is exactly how a slice publishes its surface through `index.ts`. On a name like
`Button`, `use`, `request` or `env`, grep returns noise and you guess.

**Rule: if you are about to grep for a TypeScript symbol, use the LSP instead.** Keep grep for
what it is good at — text that is not a symbol: Tailwind classes, copy strings, config keys,
TODO markers, prose in Markdown.

Two things that waste a call if you get them wrong:

- **Line and character are both 1-based, and the position must sit _on_ the symbol.** A cursor
  one column off returns "No definition found", which reads exactly like "this symbol has no
  definition". Count to the identifier, do not aim at the assignment.
- **`workspaceSymbol` needs its `query`.** Empty queries return nothing from most servers.

**It is configured as a plugin, not in `.mcp.json`.** Declaring `typescript-language-server`
behind `mcp-language-server` was tried and does not work. The bridge fails to start against
`tsls`. Against `vtsls`, it lists all six tools, resolves nothing, and crashes on `hover`.
Do not reintroduce it. If you swap the backing server, prove a real `goToDefinition` and
`hover` against this repository.

Setup is one command per machine and a clone does not inherit it — see the README.

## Standards

Rules live **next to the code they govern**. Each directory below owns its own `AGENTS.md`.
Read the one for the directory you are changing.

| Directory         | Owns                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `src/features/`   | The slice contract: `ui` / `services` / `repositories` / `index.ts`    |
| `src/core/`       | `env`, HTTP wrapper, error hierarchy, logger, Query/Apollo clients     |
| `src/components/` | The design system: what earns promotion, accessibility by construction |
| `src/test/`       | MSW handlers, fakes vs interception, offline guarantees                |
| `e2e/`            | Playwright: what belongs in a browser and what does not                |

Nested `AGENTS.md` files are **path-scoped**: working in `src/core/` does not load
`src/features/AGENTS.md`. So `docs/architecture.md` keeps only what must hold everywhere —
the dependency rule, interfaces, data fetching, config, types, styling, accessibility,
performance, testing, dependency policy. Load it with `/arch` before non-trivial design work.

The four rules to know without reading anything:

- **The dependency rule, fractally.** Within a slice `ui` → `services` → `repositories` →
  `core`. Across slices, only through the other slice's `index.ts`. `core` and `env` sit at
  the bottom and depend on nothing above.
- **Depend on interfaces**, not implementations. A repository is an interface with an `Http*`
  and a `Fake*`; services take it as an option with a production default.
- **Zod at every boundary.** Parse, never `as`. Explicit types on every export, no `any`.
- **Unit tests stay offline.** MSW intercepts everything; the browser suite is Playwright.

Pick the architectural style and design pattern per feature during planning, not while coding,
and record the choice — `docs/architecture.md` §0.

## Reference documentation — read before you write

Load the row that matches the task. Reading the wrong file costs tokens; reading none costs a
rewrite.

| When you are…                                  | Read first                                              |
| ---------------------------------------------- | ------------------------------------------------------- |
| Adding a feature, or deciding where code goes  | `src/features/AGENTS.md`                                |
| Adding config or an env var                    | `src/core/AGENTS.md` → Configuration                    |
| Adding, setting or rotating a secret or key    | `docs/secrets.md`                                       |
| Adding logging or designing an error type      | `src/core/AGENTS.md` → Logging, Errors                  |
| Writing a repository, or validating a response | `src/features/AGENTS.md` → layers                       |
| Choosing REST vs GraphQL, or tuning a query    | `docs/architecture.md` §3                               |
| Promoting a component to the design system     | `src/components/AGENTS.md`                              |
| Styling anything                               | `docs/architecture.md` §10                              |
| Choosing a visual direction for new UI         | an available design skill, or the delivery fallback     |
| Building an interaction, a dialog, or a form   | `src/components/AGENTS.md` → Accessible by construction |
| Deciding SSR, SSG, or SEO                      | `docs/architecture.md` §7                               |
| Working on bundle size, caching, or streaming  | `docs/architecture.md` §12                              |
| Writing any unit or component test             | `src/test/AGENTS.md`                                    |
| Writing a browser test                         | `e2e/AGENTS.md`                                         |
| Choosing an architecture or a new library      | `docs/architecture.md` §0, §14                          |
| Working with Linear or branch names            | `docs/agents/issue-tracker.md`                          |
| Applying a triage label                        | `docs/agents/triage-labels.md`                          |

## Writing style — ASD-STE100

Write every **new** artifact in Simplified Technical English: plans, specs, tickets, pull
request bodies, code comments, JSDoc and rule files.

- One instruction per sentence. Keep an instruction under 20 words.
- Use the active voice. Write "the service validates the input", not "the input is validated".
- Use one word for one meaning. Do not alternate between "fetch", "get" and "retrieve" for the
  same operation.
- Say what to do, not what to avoid, where both are possible.
- Use the simplest word that is accurate. Technical nouns stay as they are.
- Do not use metaphor, idiom or humour. They do not translate, and an agent reads them
  literally.
- Keep a paragraph to one topic.

This applies to new writing. Existing documents are rewritten only when they are edited for
another reason.

## Stack

Fixed in `package.json` — read it there. What the file doesn't explain:

| Concern              | Choice and why                                                                         |
| -------------------- | -------------------------------------------------------------------------------------- |
| Build                | **Vite** over a meta-framework — this is an SPA harness; SSR is a documented §7 choice |
| Server state         | **TanStack Query** for REST, **Apollo** for GraphQL — never `useState` + `useEffect`   |
| Boundary validation  | **Zod**, because TypeScript types vanish at runtime and responses do not               |
| Layering enforcement | **eslint-plugin-boundaries** — the dependency rule is a guardrail, not a convention    |
| Offline tests        | **MSW** with `onUnhandledRequest: 'error'`, so an unmocked request fails the test      |
| Styling              | **Tailwind**, tokens in `tailwind.config.js`                                           |

Introducing an alternative to any of these means updating `docs/architecture.md` first.

## AI features

- All Anthropic calls run **server-side**. `ANTHROPIC_API_KEY` must never be `VITE_`-prefixed;
  Vite inlines those into the bundle, so the key ships to every visitor.
- Default model `claude-opus-4-8`; downgrade to `claude-sonnet-4-6` for routine work.
  Configure via env (`ANTHROPIC_MODEL`), read once in server-side config, never inline.
- No `temperature` / `top_p` / `top_k`; use adaptive thinking for complex reasoning.
  Prompt-cache static system prompts.
- Stream long outputs — `docs/architecture.md` §12 → Streamed responses.

## Issue tracker

**Linear** runs through Docker MCP Toolkit. Authenticate Linear in Docker Desktop and enable
its server for the active Toolkit profile. Check `/mcp` for the Toolkit gateway and its
Linear tools. MCP servers load at session start, so a Toolkit or config change needs a
restart. Conventions, tool discovery and wayfinding:
`docs/agents/issue-tracker.md`. PRs stay on GitHub.

**Select the Development workspace in Docker Desktop.** Toolkit clients share this
connection. Confirm the workspace before a write if another repository changes it.

Workspace **Development**, team **Frontend**, key **`FRO`** — so issues read `FRO-123`. Branch
as `<type>/FRO-<num>-<slug>` (e.g. `feat/FRO-412-search-filters`) so review can resolve
the originating ticket mechanically. `BAC` (Backend) is the sibling team in the same
workspace; it is not this repo's.

## Guardrails

- **Explicit image-input consent (HARD RULE).** Before starting ANY task in the session that
  would feed an image into the model — taking or attaching a screenshot (including
  `mcp__chrome-devtools__take_screenshot`), recording a screencast, pasting a design mockup,
  reading a diagram or a PDF page as an image — **STOP and explicitly ask the user for
  permission first, and do not proceed until they confirm.** This applies even mid-task.
  Prefer `take_snapshot`: it is a text a11y-tree snapshot, it needs no consent, and it shows
  the roles and names assistive technology exposes. The rule is written by **capability, not
  by tool name** — a new image-producing tool is covered the day it appears, without an edit
  here.
- **Approved stack is fixed.** Introducing a different framework or library requires updating
  this file and `docs/architecture.md` first (§14, Dependency policy).
- **Secrets never reach the browser.** Only `VITE_`-prefixed env vars are bundled — treat them
  as public. `ANTHROPIC_API_KEY` and `GH_TOKEN` are server and build-side only.
- **Secrets never reach the transcript.** A key is compromised the moment its value enters
  the context window — it is on disk and in an API request in the same step, and only
  rotation undoes that. So: never print a secret, never read a file to see one, and refer to
  a key by name. Docker MCP Toolkit owns its Linear credential. Never copy it into an
  environment variable — the shell tool is a child
  process and inherits one, so `echo $KEY` would print it. Never in a `settings.json` `env`
  block either; that leaves the literal in a plaintext file an agent opens for unrelated
  edits, which is how this repo lost a key. Adding, storing or rotating any key:
  **`docs/secrets.md`**.

## Browser work — two tools, two jobs

Do not confuse them. They are not alternatives.

|                    | Tool                                         | Job                                                                                            |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Fast loop**      | `chrome-devtools` MCP                        | Agent-driven. Build, iterate on design, debug, profile. Costs tokens per run; asserts nothing. |
| **Regression net** | `@playwright/test` → `e2e/`, `pnpm test:e2e` | Scripted specs. Runner, assertions, retries, CI. Costs nothing per run; fails the build.       |

**Chrome DevTools MCP is not a test framework.** It has no runner, no assertions and no CI
integration, so nothing it does can fail a build or catch a regression six months from now.
Its value is inspection: `take_snapshot` (text a11y tree), console and network, and
`performance_start_trace` / `performance_analyze_insight` for Core Web Vitals against real
Chrome.

**The pipeline is explore → promote.** Drive the browser to work out what the behaviour
should be; the moment it is settled, write it into `e2e/` as a spec. An agent re-driving a
browser is a re-inspection, not a regression test. A fast-loop session that changed user-
visible behaviour and added no spec has left the behaviour unguarded — say so rather than
calling it done.

`e2e/` stays chromium-only and Playwright stays a devDependency; swapping the MCP server
changed neither. If cross-browser coverage is ever needed, add a WebKit project to
`playwright.config.ts` — real regression coverage — rather than a second MCP server.

The flags in `.mcp.json` are deliberate. They give the server a throwaway profile, keep
`Authorization` and cookies out of the transcript, and stop usage data and traced URLs
leaving the machine. Keep them. Attaching to a live Chrome with `--browserUrl` or
`--autoConnect` means acting as the logged-in user; that is a deliberate, per-task decision,
never the committed default.

## Environment

- Secrets live in `.env` (gitignored); `.env.example` lists the keys. `src/env.ts` is the only
  reader of `import.meta.env`. `protect_paths.mjs` refuses to **read** `.env`, so ask the user
  to check a value rather than opening the file — `.env.example` stays readable.
- `GH_TOKEN` needs `repo` + `workflow` scope for PR automation.
- PowerShell: `$env:VAR = "value"`, backtick continues a line, `;` chains — `&&` does not work
  in 5.1. `pnpm` needs no `cd` prefix.

## Where workflows come from

<!-- harness:agnostic -->

- The commands and the shared skills are **layer A**, vendored under
  `.agents/vendor/harness/{commands,skills}/` and pinned by sha. Every stack fact they need
  comes from `harness.config.json` at the repo root — the gates, the dev server, the review
  axes. **Never edit anything under `.agents/vendor/`**; `vendor-freshness.yml` fails on a
  hand edit as loudly as on a stale pin.
- `.agents/skills/` holds this repo's own procedures — `delivery`, `preflight` — plus one
  thin stub per shared command and skill, because a harness that discovers skills by
  directory does not glob the vendored tree. A stub is an address, not a copy.
- `.claude/skills/` adapts only the repo-owned ones. A shared skill must have no adapter:
  on `main` the plugin supplies it, and a pointer would materialise a shadowing duplicate.
- Installed plugins can implement a workflow stage, but they are optional accelerators.
- `docs/harness-compatibility.md` defines capability discovery and fallbacks.
  <!-- /harness:agnostic -->
  <!-- harness:claude
- **The `harness` plugin** — declared in `.claude/settings.json`. It supplies the eight
  workflow commands, the eight shared review frames and the shared skills, and reads
  `harness.config.json` at this repo's root for every stack fact. Never edit its files here.
- `.claude/skills/` — this repo's own procedures, `pnpm`-aware. Edit freely. The names and
  descriptions are already in the session's skill listing; do not enumerate them here.
- **`mattpocock-skills` plugin** — declared in `.claude/settings.json`; files live under
  `~/.claude/plugins/`. Installed from upstream's marketplace (`mattpocock/skills`), **not**
  Anthropic's mirror, which lags a version behind. Never vendor them into the repo.
- **`frontend-design` plugin** — the visual-design skill, enabled in `.claude/settings.json`
  so a clone inherits it. Invoke it **at plan time**, not mid-build.
  /harness:claude -->

For visual work, use an installed design skill when available. Otherwise use the design
fallback in the delivery skill. Tokens go in `tailwind.config.js`; a new typeface is a §14
dependency decision; image-based critique needs explicit image-input consent.

## Memory

Durable, non-obvious facts go in `~/.claude/projects/<project-slug>/memory/` — one fact per
file, pointer line in `MEMORY.md`. Save decisions, constraints and friction lessons; leave
anything the repo already records to the repo. `/retro` captures a lesson; `/context` audits.

When compacting, preserve the list of modified files and the commands needed to verify them.

### Second brain

A layer above memory, in the user's own notes rather than the agent's:

- **Write** — `session_learnings.mjs` (SessionEnd) distils the session's mistakes and their
  fixes into a dated note under `Project Learnings`. It writes **nothing** when a session
  taught nothing. Every run appends one outcome line to `_hook.log` beside the notes, so a
  missing note is diagnosable: no log line means SessionEnd never fired (a closed terminal
  window skips it); a `failed:` line names the reason. When a session's notes matter, end it
  cleanly rather than closing the window.
- **Index** — **not this repo's job.** `python-harness` owns both indexes and rebuilds them
  when a session ends there. **Never add an indexer here.**
  `/search-second-brain` explains why, and covers the resulting lag.
- **Read** — `/search-second-brain <topic>`. Read-only by design.

Set `OBSIDIAN_VAULT_DIRECTORY` in **user** settings. Do not set it in this repo's committed
`.claude/settings.json`. The hook and `/search-second-brain` append `Project Learnings` when
they need the learnings directory.

Three tiers, deliberately: harness memory is for this project's facts, the second brain is
for transferable lessons, and `AGENTS.md`, `docs/architecture.md`, and nested `AGENTS.md`
files are for rules. Promote recurring lessons into the portable repository layer.
