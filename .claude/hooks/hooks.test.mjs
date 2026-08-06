/**
 * Tests for the enforcement layer itself.
 *
 * The Stop gate is what makes a session walk-away-able, so its pathspec is pinned here:
 * dropping an entry from `GATED_PATHS` / `GATED_FILES` fails this suite rather than
 * silently narrowing what the harness enforces. That failure mode is invisible otherwise —
 * a narrower gate looks exactly like a passing one.
 */

import { describe, expect, it } from 'vitest';

import { describe as describeNote, frontMatter, truncate } from './vault_index.mjs';
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

describe('vault index', () => {
  it('folds a block sequence into one comma-joined value', () => {
    const fields = frontMatter('---\ntags:\n  - a\n  - b\nproject: fe\n---\n\nbody\n');
    expect(fields.tags).toBe('a, b');
    expect(fields.project).toBe('fe');
  });

  it('treats unterminated front matter as body text', () => {
    expect(frontMatter('---\ntags: [a]\n\nno closing rule')).toEqual({});
  });

  it('prefers a hand-written summary over inferred prose', () => {
    const note = '---\nsummary: What MSW does at module scope\n---\n\n# Heading\n\nSome prose.\n';
    expect(describeNote(note)).toBe('What MSW does at module scope');
  });

  it('skips headings and bullets when inferring a description', () => {
    const note = '# Heading\n\n- a bullet\n\nThis is the first real sentence of prose here.\n';
    expect(describeNote(note)).toBe('This is the first real sentence of prose here.');
  });

  it('cuts a long description on a word boundary', () => {
    expect(truncate('word '.repeat(60))).toMatch(/word…$/);
  });
});
