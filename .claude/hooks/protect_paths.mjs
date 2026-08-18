#!/usr/bin/env node
/**
 * PreToolUse hook: refuse edits to human-owned and generated paths, and refuse reads
 * of the paths that hold secrets.
 *
 * Exit 2 is the ONLY exit code that blocks a tool call; stderr becomes the reason
 * Claude sees. Exit 1 lets the write through with a warning, which is the most
 * common hook bug.
 *
 * **The matcher must cover every tool that can write a file, not just `Edit|Write`.**
 * A hook matcher is a case-sensitive regex over the tool name, so `Edit|Write` misses
 * `NotebookEdit` and every MCP write tool — including `mcp__typescript-lsp__edit_file`,
 * which `.mcp.json` enables. A protected path is protected only on the tool surfaces
 * the matcher names. See `.claude/settings.json`.
 *
 * **Reads are blocked for secrets only.** A write to a generated file is a mistake the
 * author can undo; a read of `.env` is not. The value enters the context window, the
 * transcript on disk and the API request in one step, and only rotation undoes that. So
 * `.env` refuses both verbs while `dist/` refuses only the write.
 *
 * A permission `deny` rule cannot express this: it has no exception syntax, so
 * `Read(./.env.*)` would also hide `.env.example` — the committed file that documents
 * the env contract. `ALLOWED` below is that exception, which is why the rule lives here.
 *
 * This script no-ops on any payload without `tool_input.file_path`, so widening the
 * matcher is always safe: a tool that slips through without one simply exits 0. Bash is
 * such a tool — it carries `command`, not `file_path` — so `cat .env` is out of scope
 * here and is denied in `.claude/settings.json` instead.
 */

import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readPayload, relativePath, toolPaths } from './lib.mjs';

/** Refuse writes. Reading the file costs nothing, so reading stays allowed. */
const WRITE = 'write';

/** Refuse writes and reads. The contents must not reach the transcript. */
const SECRET = 'secret';

/** Globs matched against the repo-relative, forward-slashed path, with what each refuses. */
const PROTECTED = [
  ['.env', 'holds real secrets and is gitignored', SECRET],
  ['.env.*', 'holds real secrets and is gitignored', SECRET],
  ['pnpm-lock.yaml', 'regenerate with `pnpm install`, never hand-edit', WRITE],
  ['dist/**', 'build output; change the source instead', WRITE],
  ['**/generated/**', 'generated output; change the generator instead', WRITE],
  ['**/__generated__/**', 'GraphQL codegen output; change the schema or document instead', WRITE],
  ['**/*.gen.ts', 'generated output; change the generator instead', WRITE],
  ['.husky/_/**', 'husky writes this directory; edit `.husky/pre-commit` instead', WRITE],
];

const ALLOWED = new Set(['.env.example']);

/**
 * Tool names that only read. Every other tool the matcher admits is treated as a write,
 * so a new write tool is covered the day the matcher names it.
 */
const READ_TOOLS = new Set(['Read']);

/**
 * Compile one glob. `**` crosses directory separators, `*` does not — the
 * distinction is what lets `dist/**` cover the whole tree while `.env.*` stays
 * confined to one path segment.
 */
export function globToRegExp(pattern) {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') {
        source += '(?:.*/)?'; // A `**/` prefix must also match zero directories.
        i += 2;
      } else {
        source += '.*';
        i += 1;
      }
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

const COMPILED = PROTECTED.map(([pattern, why, scope]) => [globToRegExp(pattern), why, scope]);

/**
 * Why `toolName` must not touch `path`, or `null` when the call is allowed.
 *
 * `path` is repo-relative and forward-slashed. A read is refused by `SECRET` entries
 * only; a write is refused by every entry.
 */
export function blockReason(path, toolName) {
  const name = path.split('/').pop() ?? path;
  if (ALLOWED.has(name)) return null;

  const reading = READ_TOOLS.has(toolName);
  for (const [pattern, why, scope] of COMPILED) {
    if (reading && scope !== SECRET) continue;
    if (pattern.test(path) || pattern.test(name)) return why;
  }
  return null;
}

async function main() {
  const payload = await readPayload();
  const toolName = payload.tool_name ?? '';
  for (const raw of toolPaths(payload)) {
    const path = relativePath(raw, payload.cwd ?? '');
    const why = blockReason(path, toolName);
    if (!why) continue;

    // ASCII only: hook stderr is decoded by the harness, and a Windows console
    // codepage can mangle non-ASCII on the way out.
    const [verb, advice] = READ_TOOLS.has(toolName)
      ? [
          'read',
          'A value read here enters the transcript, and only rotation undoes that.\n' +
            'Refer to the variable by name, or ask the user to check it.\n',
        ]
      : ['edit', 'Ask the user to make this change, or explain why it is required.\n'];
    process.stderr.write(`Refusing to ${verb} ${path} - ${why}.\n${advice}`);
    return 2;
  }
  return 0;
}

// Run only when invoked as a hook, never on import — the test suite imports this module
// for `globToRegExp`, and reading stdin on import would hang the suite.
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
