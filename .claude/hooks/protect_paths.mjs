#!/usr/bin/env node
/**
 * PreToolUse hook: refuse edits to human-owned and generated paths.
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
 * This script no-ops on any payload without `tool_input.file_path`, so widening the
 * matcher is always safe: a non-write tool that slips through simply exits 0.
 */

import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readPayload, relativePath } from './lib.mjs';

/** Globs matched against the repo-relative, forward-slashed path. */
const PROTECTED = [
  ['.env', 'holds real secrets and is gitignored'],
  ['.env.*', 'holds real secrets and is gitignored'],
  ['pnpm-lock.yaml', 'regenerate with `pnpm install`, never hand-edit'],
  ['dist/**', 'build output; change the source instead'],
  ['**/generated/**', 'generated output; change the generator instead'],
  ['**/__generated__/**', 'GraphQL codegen output; change the schema or document instead'],
  ['**/*.gen.ts', 'generated output; change the generator instead'],
  ['.husky/_/**', 'husky writes this directory; edit `.husky/pre-commit` instead'],
];

const ALLOWED = new Set(['.env.example']);

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

const COMPILED = PROTECTED.map(([pattern, why]) => [globToRegExp(pattern), why]);

async function main() {
  const payload = await readPayload();
  const raw = payload?.tool_input?.file_path;
  if (!raw) return 0;

  const path = relativePath(raw, payload.cwd ?? '');
  const name = path.split('/').pop() ?? path;
  if (ALLOWED.has(name)) return 0;

  for (const [pattern, why] of COMPILED) {
    if (pattern.test(path) || pattern.test(name)) {
      // ASCII only: hook stderr is decoded by the harness, and a Windows console
      // codepage can mangle non-ASCII on the way out.
      process.stderr.write(
        `Refusing to edit ${path} - ${why}.\n` +
          'Ask the user to make this change, or explain why it is required.\n',
      );
      return 2;
    }
  }
  return 0;
}

// Run only when invoked as a hook, never on import — the test suite imports this module
// for `globToRegExp`, and reading stdin on import would hang the suite.
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
