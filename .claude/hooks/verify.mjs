#!/usr/bin/env node
/**
 * Stop hook: refuse to end the turn while the Definition of Done is failing.
 *
 * Smart by design — the gates only run when the turn touched something that can
 * actually make them fail. That is the line: **code the gates check, plus the config
 * that defines the gates**. Prose, plans and docs still end freely, so writing work
 * never burns toward the 8-consecutive-block override Claude Code applies to Stop
 * hooks.
 *
 * Three path groups qualify (see GATED_PATHS / GATED_FILES):
 *
 * - `src/`, `e2e/` — the application, its component tests and its E2E specs.
 * - `.claude/hooks/` — these scripts. Prettier formats them and Vitest tests them, so
 *   a broken edit here fails the same gates as `src/`. Leaving them out meant the
 *   enforcement layer was the one thing the walk-away gate could not catch.
 * - The tool config at the repo root — `package.json`, `tsconfig.json`,
 *   `eslint.config.js`, `vite.config.ts` and the rest. A change to any of them can
 *   break every gate at once while touching no application code.
 *
 * The tradeoff this balances: widening the filter costs some override budget on
 * config work, but the excluded set that motivated the original narrow filter —
 * Markdown, plans, docs — is still excluded, and those are what sessions actually
 * churn on. Editing a hook or the tool config is rare and deserves the gate.
 *
 * Convergence matters: every gate here is one Claude can actually fix. A check that
 * can never pass wastes 8 turns of tokens before being overridden anyway.
 *
 * Escape hatch: set `HARNESS_SKIP_VERIFY=1` to disable for a session. The legacy
 * `CLAUDE_SKIP_VERIFY` name remains supported — the gate is not Claude's, and naming it
 * after one harness is how the same escape hatch ended up with two names.
 */

import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readPayload, run, tail } from './lib.mjs';

/**
 * The Definition of Done, in the order `/verify` runs it.
 *
 * `pnpm build` is a gate because only the build checks the browser target. A top-level
 * `await` passes `typecheck` and still fails `vite build` against es2020 — that class of
 * break escaped to CI once (PR #9) and must not again.
 */
export const GATES = [
  ['pnpm lint', ['run', 'lint']],
  ['pnpm format:check', ['run', 'format:check']],
  ['pnpm typecheck', ['run', 'typecheck']],
  ['pnpm test', ['run', 'test']],
  ['pnpm build', ['run', 'build']],
];

const MAX_LINES = 40;

/** Directories whose source files the gates check. See the module docstring. */
export const GATED_PATHS = ['src', 'e2e', '.claude/hooks'];

/**
 * Individual files that configure the gates themselves, or that the harness runs
 * outside them; a change breaks something without touching any application code.
 */
export const GATED_FILES = new Set([
  // These files configure external tools that Vitest checks.
  '.codex/config.toml',
  '.codex/hooks.json',
  '.mcp.json',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'eslint.config.js',
  'vite.config.ts',
  'vitest.setup.ts',
  'playwright.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  '.prettierrc.json',
  '.prettierignore',
]);

/**
 * Extensions the gates read. `.css` is in because `format:check` covers it and
 * Tailwind layers live there; Markdown is deliberately out — see the docstring.
 */
export const GATED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css'];

/**
 * Extract the path from one `git status --porcelain` line.
 *
 * Format is two status chars, a space, then the path. Renames and copies read
 * `old -> new`; the destination is the one that exists on disk. Paths containing
 * special characters are quoted.
 */
export function porcelainPath(line) {
  const entry = line.slice(3).trim();
  const arrow = entry.lastIndexOf(' -> ');
  const path = arrow === -1 ? entry : entry.slice(arrow + 4);
  return path.trim().replace(/^"|"$/g, '');
}

/** True if `path` is something the gates would read. */
export function isGated(path) {
  if (GATED_FILES.has(path)) return true;
  return GATED_EXTENSIONS.some((extension) => path.endsWith(extension));
}

/** True if the turn touched gated source or the tool config that gates it. */
export function gatedChange(cwd) {
  const result = run('git', ['status', '--porcelain', '--', ...GATED_PATHS, ...GATED_FILES], {
    cwd,
    timeout: 30_000,
  });
  if (result.status !== 0) return false; // Can't tell -> don't block.
  return result.stdout.split(/\r?\n/).filter(Boolean).map(porcelainPath).some(isGated);
}

async function main() {
  if (process.env.HARNESS_SKIP_VERIFY === '1' || process.env.CLAUDE_SKIP_VERIFY === '1') return 0;

  const payload = await readPayload();
  if (!payload) return 0;

  const cwd = payload.cwd ?? '';
  if (!gatedChange(cwd)) return 0;

  for (const [label, args] of GATES) {
    const result = run('pnpm', args, { cwd, timeout: 540_000 });
    if (result.error) {
      process.stderr.write(`Could not run \`${label}\`: ${result.error.message}\n`);
      return 0; // Tooling problem, not a code problem -> don't block.
    }
    if (result.status !== 0) {
      const out = tail(result.stdout + result.stderr, MAX_LINES) || '(no output)';
      // ASCII only - see protect_paths.mjs.
      process.stderr.write(
        `Definition of Done is failing at \`${label}\`. Fix this before finishing. ` +
          `Do not summarise the failure as if it were done.\n\n${out}\n`,
      );
      return 2;
    }
  }
  return 0;
}

// Run only when invoked as a hook, never on import — the test suite imports this
// module for its constants. `resolve` on both sides because the harness spells the
// hook path with forward slashes even on Windows, where `argv[1]` keeps them.
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
