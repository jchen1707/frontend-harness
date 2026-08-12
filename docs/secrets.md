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

| Reader                 | Example                         | Where the value lives   | Where the name is declared    |
| ---------------------- | ------------------------------- | ----------------------- | ----------------------------- |
| The browser            | `VITE_API_BASE_URL`             | `.env`                  | `src/env.ts` + `.env.example` |
| A server or build step | `ANTHROPIC_API_KEY`, `GH_TOKEN` | `.env`                  | `.env.example`                |
| Claude Code itself     | The Linear PAT                  | **OS credential store** | `.mcp.json` `headersHelper`   |

**Browser values are public, whatever you call them.** Vite inlines every `VITE_`-prefixed
variable into the bundle. Anyone who loads the page can read it. A real secret behind a
`VITE_` prefix is a published secret. This is why `ANTHROPIC_API_KEY` has no prefix, and
why all Anthropic calls run server-side.

**Claude Code values are in no file and no variable.** They are not in `.env`, not in
`.env.example`, and not in any `settings.json`. A credential helper fetches them at
connection time. §4 explains why.

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

This is the strictest case, because the value has to be reachable by Claude Code itself.

1. Store the value in the **OS credential store**, under a slot name (see §5).
2. Add a `headersHelper` to the server in `.mcp.json`, naming that slot. Commit it.
3. Restart Claude Code. MCP servers read their config at session start.

```json
"linear": {
  "type": "http",
  "url": "https://mcp.linear.app/mcp",
  "headersHelper": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/mcp-headers.mjs\" linear-fro"
}
```

Claude Code runs the helper at connection time, reads a JSON object of headers from its
stdout, and merges them into the request. It re-runs the helper on reconnect, and on a 401
or 403 it re-runs and retries once. The model never sees stdout.

**Do not use a `${VAR}` header.** `"Authorization": "Bearer ${LINEAR_API_KEY}"` works, and
it is the obvious configuration, but it needs the key in Claude Code's own environment. The
Bash tool is a child process and inherits it, so `echo $LINEAR_API_KEY` prints the key. One
careless command puts it in the transcript.

**Do not put the value in `~/.claude/settings.json` under `env`.** That block keeps the key
out of git, and it is often recommended for exactly that reason. It is still the wrong
place. The literal sits in a plaintext file that an agent opens for unrelated edits — a
plugin toggle, a permission entry, a hook path. One full-file read copies the key into the
transcript. This repo has lost a key that way.

**Never put the value in this repo's committed `.claude/settings.json`.** Every clone reads
it.

### Why a personal API key, and not OAuth

Linear's remote MCP server supports OAuth, and OAuth would remove the long-lived key. This
repo does not use it, on purpose.

The claude.ai account connector is **one Linear connection for the whole account**. Pointing
it at a different workspace moves every project at once, including `python-harness`, whose
triage labels live in a different workspace. OAuth against the same server URL has the same
shape: credentials key to the URL, so a second repo declaring `https://mcp.linear.app/mcp`
shares the token and the workspace.

A personal API key belongs to the workspace that created it, so declaring it here binds this
repo to one workspace and nothing can drift it. The slot name in the `headersHelper` command
is what carries that binding — `linear-fro` here, a different slot in a sibling repo. **Do
not "fix" this into OAuth.** It silently moves `python-harness` to this workspace.

The cost of that choice is a long-lived credential. §5 and §6 are how that cost is managed.

---

## 5. Set the value without leaking it

Two ways to leak a key while setting it: shell history, and the transcript. Do this
yourself, in a real terminal. An agent must not be in the room when the value is typed.

**Do not use the `!` prefix for this.** In this harness `!` runs Git Bash, and it runs
non-interactively. A prompt-based command hits EOF immediately and does nothing visible.
`Read-Host` returns zero characters, and the store then holds an empty value — which is
indistinguishable from never having set it until a connection fails.

Run this in an interactive PowerShell window, once per slot:

```powershell
$slot = 'linear-fro'
$dir  = Join-Path $env:USERPROFILE '.claude\mcp-credentials'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$sec = Read-Host -AsSecureString "Paste the value for $slot"
$len = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Length
if ($len -lt 20) { throw 'Refusing to write: value looks empty or truncated.' }

$sec | ConvertFrom-SecureString | Set-Content (Join-Path $dir "$slot.cred")
```

`ConvertFrom-SecureString` encrypts with DPAPI against your Windows account. The file is
inert to another user, and to you on another machine. No plaintext touches the disk.

Notes that cost real time when missed:

- **`Ctrl+V` does not paste at a `Read-Host` prompt** in the classic PowerShell console.
  Right-click pastes. Windows Terminal handles `Ctrl+V` normally.
- **Avoid `setx KEY "value"`** and any command taking the literal as an argument. It goes
  straight into shell history.
- **A running session keeps its connection.** Restart Claude Code after storing.

To confirm the slot works without printing the value:

```sh
node .claude/mcp-headers.mjs linear-fro | ForEach-Object { $_.Length }   # a number, not the key
```

On macOS the helper reads `security find-generic-password -s claude-mcp-<slot> -w`; on Linux,
`secret-tool lookup service claude-mcp-<slot>` (needs `libsecret-tools`). Store the value with
the matching `security add-generic-password` or `secret-tool store`.

### Migrating off an environment variable

A key that was ever an environment variable has been readable by every child process for as
long as it existed. Treat it as exposed and **rotate it** — do not move the same value into
the store. Then delete the variable, so nothing keeps reading a revoked key:

```powershell
[Environment]::SetEnvironmentVariable('LINEAR_API_KEY', $null, 'User')
```

Confirm it is gone in a **new** terminal — a running shell keeps its copy:

```powershell
[Environment]::GetEnvironmentVariable('LINEAR_API_KEY', 'User') -eq $null
```

---

## 6. What stops a key reaching the transcript

**Read this section as accident prevention, not containment.** Every layer below assumes an
agent that is not trying to read the key. None of them stops one that is: the Bash tool runs
as your user, so anything you can read, it can read. That is a property of running an agent
with a shell, not a gap to close. What follows removes the paths a key leaks down by
mistake — which is the way this repo actually lost one.

The distinction that matters is **ambient** versus **reachable**:

- An _ambient_ secret is one sitting in an environment variable or a plaintext file. It
  leaks when something reads that place for an unrelated reason. No intent required.
- A _reachable_ secret needs a specific, deliberate command to retrieve. That command is not
  in `permissions.allow`, so it prompts you first.

The work in this repo moves every secret from ambient to reachable. It does not, and cannot,
make one unreachable.

| Layer                         | Covers                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `headersHelper` (`.mcp.json`) | No environment variable holds the Linear key, so `echo`, `printenv` and `env` find nothing.                   |
| `protect_paths.mjs` (hook)    | Refuses `Read` **and** write on `.env` and `.env.*`. Permits `.env.example`, the committed template.          |
| `permissions.deny`            | Refuses `cat .env` and its obvious neighbours. Bash carries no `file_path`, so the hook cannot see it.        |
| `secretlint` (pre-commit)     | Scans every staged file. Blocks the commit when a key pattern matches, and masks the value in its own output. |
| Default permission mode       | `cat`, `node` and `printenv` are not in `permissions.allow`, so each prompts. **You** are this layer.         |

**The Bash layer is porous and is meant to be.** A deny list names commands, and there are
many ways to print a file. It stops the obvious call, not a determined one. The hook is the
real boundary for file reads; the deny list is a second latch on the one surface the hook
cannot reach.

**The last row is the one that matters most.** The deny list only turns a prompt into a
refusal, which changes nothing while you are answering prompts. It earns its place when a
session runs unattended. So: do not run this repo with broad `Bash` permissions, or with
permission checks skipped, while a live credential is on the machine.

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
3. Store it by §5, overwriting the same slot.
4. Restart Claude Code.
5. Confirm the rotation against the **stored** value, not against a working tool call.

Step 5 is the one that gets skipped. A successful MCP call proves the connection Claude Code
opened at session start is valid. It says nothing about what you just wrote to the store — a
running session holds the connection and keeps succeeding on the old key. Run the helper
directly and compare its output length against the new key's length.

Rotation is the primary control here, not a fallback. A long-lived personal API key is the
price of per-repo workspace binding (§4), so the thing that limits the damage is how fast it
is replaced. If Linear offers a scoped or expiring personal key, prefer it — that bounds the
damage before it happens.

If the key reached a git commit, revoking it is still the fix. Rewriting history does not
help — the value has already been fetched, and the commit may be mirrored.
