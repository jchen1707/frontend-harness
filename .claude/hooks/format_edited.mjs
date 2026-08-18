#!/usr/bin/env node
/**
 * PostToolUse(Edit|Write) hook: format and autofix the file that was just edited.
 *
 * Deliberately non-blocking — it always exits 0. Formatting is a fixup, not a gate;
 * the gate is the Stop hook in `verify.mjs`. Keeping this advisory means a formatting
 * hiccup can never wedge a turn.
 *
 * It formats **every** extension Prettier owns, not only the ones the Stop gate
 * watches. `pnpm format:check` covers Markdown and JSON too, so a doc edit that skips
 * formatting here fails the gate later in a session that never touched it.
 */

import { extname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readPayload, run, shellSafe, toolPaths } from './lib.mjs';

/** Extensions Prettier formats in this repo. Matches `.prettierignore` in spirit. */
const PRETTIER = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.md',
  '.yml',
  '.yaml',
]);

/** Extensions ESLint can autofix. A subset of the above. */
const ESLINT = new Set(['.ts', '.tsx']);

async function main() {
  const payload = await readPayload();
  const cwd = payload.cwd ?? '';
  for (const raw of toolPaths(payload)) {
    const extension = extname(raw).toLowerCase();
    if (!PRETTIER.has(extension)) continue;

    // On Windows these commands go through `cmd.exe`, so a path carrying a shell
    // metacharacter would be interpreted rather than passed. Skipping is safe: this hook
    // is advisory, and lint-staged formats the file again at commit time.
    if (!shellSafe(raw)) continue;

    run('pnpm', ['exec', 'prettier', '--write', raw], { cwd, timeout: 60_000 });
    if (ESLINT.has(extension)) {
      run('pnpm', ['exec', 'eslint', '--fix', raw], { cwd, timeout: 120_000 });
    }
  }
  return 0;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
