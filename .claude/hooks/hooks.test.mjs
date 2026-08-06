/**
 * Tests for the enforcement layer itself.
 *
 * The Stop gate is what makes a session walk-away-able, so its pathspec is pinned here:
 * dropping an entry from `GATED_PATHS` / `GATED_FILES` fails this suite rather than
 * silently narrowing what the harness enforces. That failure mode is invisible otherwise —
 * a narrower gate looks exactly like a passing one.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { globToRegExp } from './protect_paths.mjs';
import { GATED_EXTENSIONS, GATED_FILES, GATED_PATHS, isGated, porcelainPath } from './verify.mjs';

describe('Stop-gate pathspec', () => {
  it('covers the application, its specs and the hooks that enforce the gates', () => {
    expect(GATED_PATHS).toEqual(expect.arrayContaining(['src', 'e2e', '.claude/hooks']));
  });

  it('covers the config files that define the gates', () => {
    for (const file of [
      'package.json',
      'tsconfig.json',
      'eslint.config.js',
      'vite.config.ts',
      '.prettierrc.json',
    ]) {
      expect(GATED_FILES.has(file)).toBe(true);
    }
  });

  it('gates every source extension the toolchain reads', () => {
    for (const extension of ['.ts', '.tsx', '.js', '.mjs', '.css']) {
      expect(GATED_EXTENSIONS).toContain(extension);
    }
  });

  it('leaves prose ungated so writing work never burns override budget', () => {
    expect(isGated('docs/architecture.md')).toBe(false);
    expect(isGated('CLAUDE.md')).toBe(false);
    expect(isGated('src/App.tsx')).toBe(true);
  });
});

describe('porcelainPath', () => {
  it('reads the destination of a rename, which is the file that exists', () => {
    expect(porcelainPath('R  src/old.ts -> src/new.ts')).toBe('src/new.ts');
  });

  it('unquotes a path git quoted for special characters', () => {
    expect(porcelainPath('?? "src/a b.ts"')).toBe('src/a b.ts');
  });
});

describe('protected paths', () => {
  const matches = (pattern, path) => globToRegExp(pattern).test(path);

  it('confines a single star to one path segment', () => {
    expect(matches('.env.*', '.env.local')).toBe(true);
    expect(matches('.env.*', '.env.local/nested')).toBe(false);
  });

  it('lets a leading double star match zero directories', () => {
    expect(matches('**/generated/**', 'generated/api.ts')).toBe(true);
    expect(matches('**/generated/**', 'src/features/x/generated/api.ts')).toBe(true);
  });

  it('does not treat a dot in a pattern as a regex wildcard', () => {
    expect(matches('pnpm-lock.yaml', 'pnpmXlock.yaml')).toBe(false);
  });
});

/**
 * The vault indexes have no tests here any more, because this repo no longer builds them.
 * `python-harness` owns `_VAULT_INDEX.md` and `Project Learnings/_INDEX.md`; this harness
 * writes notes and nothing else. The twin-compatibility assertions that used to live here
 * guarded a contract between two implementations — deleting the second implementation
 * retires the contract along with it.
 */
describe('second brain', () => {
  it('ships no indexer to drift against python-harness', () => {
    // A future edit that reintroduces an indexer here recreates one artifact with two
    // writers, which is the failure this repo removed rather than pinned.
    expect(existsSync(join(dirname(fileURLToPath(import.meta.url)), 'vault_index.mjs'))).toBe(
      false,
    );
  });

  it('leaves index rebuilding out of the SessionEnd hook', () => {
    const hook = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'session_learnings.mjs'),
      'utf8',
    );
    // Strip comments first. The hook's docstring names both index files on purpose — it
    // explains why they are somebody else's job — and matching prose would fail on the
    // documentation rather than on the behaviour.
    const code = hook.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/rebuildIndex|_VAULT_INDEX|_INDEX\.md/);
    // One write, and it is the note. A second would be an index creeping back in.
    expect(code.match(/writeFileSync\(/g)).toHaveLength(1);
  });
});
