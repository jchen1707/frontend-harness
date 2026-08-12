# Secrets and API keys

How to add a key, where to put it, and what to do when one leaks.

The rule behind every step below: **a secret is compromised the moment its value enters
an agent transcript.** The value reaches the context window, the transcript file on disk
and the API request in one action. Deleting the file afterwards undoes none of that. So
the practices here keep the literal out of the model's input, which is a different goal
from keeping it out of git.

---

## 1. Decide which kind of secret it is

Answer one question first: **who reads this value?** The answer decides everything else.

| Reader                 | Example                         | Where the value lives            | Where the name is declared    |
| ---------------------- | ------------------------------- | -------------------------------- | ----------------------------- |
| The browser            | `VITE_API_BASE_URL`             | `.env`                           | `src/env.ts` + `.env.example` |
| A server or build step | `ANTHROPIC_API_KEY`, `GH_TOKEN` | `.env`                           | `.env.example`                |
| Claude Code itself     | `LINEAR_API_KEY`                | **OS user environment variable** | `.mcp.json` + `.env.example`  |

**Browser values are public, whatever you call them.** Vite inlines every `VITE_`-prefixed
variable into the bundle. Anyone who loads the page can read it. A real secret behind a
`VITE_` prefix is a published secret. This is why `ANTHROPIC_API_KEY` has no prefix, and
why all Anthropic calls run server-side.

**Claude Code values do not come from `.env`.** The harness expands `${LINEAR_API_KEY}` in
`.mcp.json` from the _process environment_. Copying that key into `.env` does nothing.

---

## 2. Add a browser value

1. Add the variable to the schema in `src/env.ts`. Give it a Zod type and a default.
2. Add it to `.env.example` above the `--- Server / build-side only ---` line.
3. Add the real value to `.env`.

`src/env.ts` is the only file that reads `import.meta.env`. Read config through `env`
everywhere else. See `docs/architecture.md` §6.

---

## 3. Add a server or build-side value

1. Add the key to `.env.example` **below** the `--- Server / build-side only ---` line.
   Leave the value empty. This file is committed.
2. Add the real value to `.env`. This file is gitignored and the agent cannot read it.
3. Give the key no `VITE_` prefix. Never.

Do not add it to `src/env.ts`. That schema parses `import.meta.env`, which holds browser
values only.

---

## 4. Add a value that Claude Code reads

This is the case with the strictest rule, because the value must survive in a place the
agent reads for other reasons.

1. Set the key as an **OS user environment variable** (see §5 for the command).
2. Reference it by name in `.mcp.json`, as `${YOUR_KEY}`. Commit that.
3. Document the key in `.env.example` under `--- Read by Claude Code, NOT by the app ---`,
   with an empty value.
4. Restart Claude Code. MCP servers read their config at session start.

**Do not put the value in `~/.claude/settings.json` under `env`.** That block keeps the key
out of git, and it is often recommended for exactly that reason. It is still the wrong
place. The literal sits in a plaintext file that an agent opens for unrelated edits — a
plugin toggle, a permission entry, a hook path. One full-file read copies the key into the
transcript, and the key then needs a rotation. This repo has lost a key that way.

**Never put the value in this repo's committed `.claude/settings.json`.** Every clone reads
it.

---

## 5. Set the value without leaking it

Two ways to leak a key while setting it: shell history, and the transcript.

**Do not use the `!` prefix for this.** In this harness `!` runs Git Bash, and it runs
non-interactively. A prompt-based command hits EOF immediately and does nothing visible.
`Read-Host` returns zero characters, and `SetEnvironmentVariable` with an empty string
**deletes** the variable rather than failing. The result is indistinguishable from never
having set it.

Use a real interactive PowerShell window, and check the length before writing:

```powershell
$value = Read-Host -AsSecureString 'Paste the key'
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
if ($plain.Length -lt 20) { throw 'Refusing to write: value looks empty or truncated.' }
[Environment]::SetEnvironmentVariable('LINEAR_API_KEY', $plain, 'User')
```

Notes that cost real time when missed:

- **`Ctrl+V` does not paste at a `Read-Host` prompt** in the classic PowerShell console.
  Right-click pastes. Windows Terminal handles `Ctrl+V` normally.
- **Avoid `setx KEY "value"`.** The literal goes straight into shell history.
- **A new environment variable does not reach a running session.** Restart Claude Code.

To confirm the variable exists without printing it:

```powershell
[Environment]::GetEnvironmentVariable('LINEAR_API_KEY', 'User').Length
```

---

## 6. What stops a key reaching the transcript

Three layers, none of which replaces the others.

| Layer                      | Covers                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `protect_paths.mjs` (hook) | Refuses `Read` **and** write on `.env` and `.env.*`. Permits `.env.example`, the committed template.          |
| `permissions.deny`         | Refuses `cat .env` and its obvious neighbours. Bash carries no `file_path`, so the hook cannot see it.        |
| `secretlint` (pre-commit)  | Scans every staged file. Blocks the commit when a key pattern matches, and masks the value in its own output. |

**The Bash layer is porous and is meant to be.** A deny list names commands, and there are
many ways to print a file. It stops the obvious call, not a determined one. The hook is the
real boundary for file reads; the deny list is a second latch on the one surface the hook
cannot reach.

`--redact-network-headers` in `.mcp.json` does the same job for the browser tooling: it keeps
`Authorization` and cookies out of network-request output.

### Adding a pattern to the scanner

`.secretlintrc.json` carries the preset plus this repo's own key shapes. A new provider with
a recognisable prefix belongs in the `patterns` array:

```json
{ "name": "Example provider key", "pattern": "/exk_[A-Za-z0-9]{20,}/" }
```

Check it against a fake key before trusting it:

```sh
pnpm exec secretlint --maskSecrets path/to/file-with-a-fake-key.ts
```

Scan the whole repo with `pnpm scan:secrets`.

---

## 7. When a key leaks

Do not reason about whether the exposure mattered. **Rotate it.**

1. Revoke the old key at the provider. Revoke first, so a copied value stops working.
2. Create the replacement.
3. Set it by §5.
4. Restart Claude Code, and any shell that held the old value.
5. Confirm the rotation against the **stored** value, not against a working tool call.

Step 5 is the one that gets skipped. A successful MCP call proves the value the process
loaded at start-up is valid. It says nothing about what you just wrote to the environment.
A long-running session keeps the old value in memory and will keep succeeding with it.
Compare the stored value's length or hash against the value you know works.

If the key reached a git commit, revoking it is still the fix. Rewriting history does not
help — the value has already been fetched, and the commit may be mirrored.
