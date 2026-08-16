/**
 * Tests for the enforcement layer itself.
 *
 * The Stop gate is what makes a session walk-away-able, so its pathspec is pinned here:
 * dropping an entry from `GATED_PATHS` / `GATED_FILES` fails this suite rather than
 * silently narrowing what the harness enforces. That failure mode is invisible otherwise —
 * a narrower gate looks exactly like a passing one.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { SLOT_PATTERN, credentialPath, headers, lookupCommand } from '../mcp-headers.mjs';
import { blockReason, globToRegExp } from './protect_paths.mjs';
import {
  DISTILLER_MARKER,
  frontMatterValue,
  isDistillerTranscript,
  noteBody,
  placeNote,
  priorBody,
  splitSummary,
} from './session_learnings.mjs';
import {
  GATED_EXTENSIONS,
  GATED_FILES,
  GATED_PATHS,
  GATES,
  isGated,
  porcelainPath,
} from './verify.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function frontmatter(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  return Object.fromEntries(
    block.split(/\r?\n/).map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator), line.slice(separator + 1).trim()];
    }),
  );
}

describe('harness-neutral compatibility adapters', () => {
  const skillRoot = join(repositoryRoot, '.agents', 'skills');
  const claudeSkillRoot = join(repositoryRoot, '.claude', 'skills');

  it('maps every canonical skill to a Claude adapter with matching discovery metadata', () => {
    const skillNames = readdirSync(skillRoot).filter((name) =>
      existsSync(join(skillRoot, name, 'SKILL.md')),
    );

    for (const name of skillNames) {
      const canonicalPath = join(skillRoot, name, 'SKILL.md');
      const adapterPath = join(claudeSkillRoot, name, 'SKILL.md');
      expect(existsSync(adapterPath), `missing Claude adapter for ${name}`).toBe(true);

      const canonical = readFileSync(canonicalPath, 'utf8');
      const adapter = readFileSync(adapterPath, 'utf8');
      expect(frontmatter(adapter)).toEqual(frontmatter(canonical));

      const target = adapter.match(/Read and execute `([^`]+)`/)?.[1];
      expect(target, `missing canonical pointer for ${name}`).toBeTruthy();
      expect(resolve(dirname(adapterPath), target)).toBe(canonicalPath);
    }
  });

  it('points every Claude instruction file at its applicable AGENTS files', () => {
    const adapters = [
      ['CLAUDE.md', ['AGENTS.md']],
      ['src/components/CLAUDE.md', ['src/components/AGENTS.md', 'AGENTS.md']],
      ['src/core/CLAUDE.md', ['src/core/AGENTS.md', 'AGENTS.md']],
      ['src/features/CLAUDE.md', ['src/features/AGENTS.md', 'AGENTS.md']],
      ['src/test/CLAUDE.md', ['src/test/AGENTS.md', 'AGENTS.md']],
      ['e2e/CLAUDE.md', ['e2e/AGENTS.md', 'AGENTS.md']],
    ];

    for (const [adapter, expected] of adapters) {
      const adapterPath = join(repositoryRoot, adapter);
      const links = [...readFileSync(adapterPath, 'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(
        (match) => resolve(dirname(adapterPath), match[1]),
      );
      expect(links).toEqual(expected.map((path) => join(repositoryRoot, path)));
    }
  });

  it('keeps every planning adapter on the portable plans directory', () => {
    const settings = JSON.parse(
      readFileSync(join(repositoryRoot, '.claude', 'settings.json'), 'utf8'),
    );
    expect(settings.plansDirectory).toBe('.agents/plans');
    expect(readFileSync(join(repositoryRoot, '.gitignore'), 'utf8')).toContain('.agents/plans/');

    for (const path of [
      '.claude/commands/plan.md',
      '.claude/commands/implement-from-plan.md',
      '.claude/agents/spec-checker.md',
      '.claude/workflows/full-review.js',
    ]) {
      expect(readFileSync(join(repositoryRoot, path), 'utf8')).not.toContain('.claude/plans');
    }
  });
});

describe('Stop-gate pathspec', () => {
  it('covers the application, its specs and the hooks that enforce the gates', () => {
    expect(GATED_PATHS).toEqual(expect.arrayContaining(['src', 'e2e', '.claude/hooks']));
  });

  it('keeps the production build in the gate set', () => {
    // Only the build checks the browser target; a top-level await passes typecheck
    // and still fails vite build. Dropping this gate re-opens that escape.
    expect(GATES.map(([label]) => label)).toContain('pnpm build');
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

  it('covers the MCP credential helper, which Vitest tests but no gated path holds', () => {
    expect(GATED_FILES.has('.claude/mcp-headers.mjs')).toBe(true);
    expect(isGated('.claude/mcp-headers.mjs')).toBe(true);
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
 * Reads of the secret files.
 *
 * A blocked write is recoverable; a read is not. The value is in the context window, the
 * transcript on disk and the API request before anyone notices, and rotation is the only
 * remedy. So `.env` refuses both verbs, and the generated paths keep refusing writes only.
 */
describe('protected paths — reads', () => {
  it('refuses to read a file that holds secrets', () => {
    expect(blockReason('.env', 'Read')).toMatch(/secrets/);
    expect(blockReason('.env.local', 'Read')).toMatch(/secrets/);
    expect(blockReason('.env.production', 'Read')).toMatch(/secrets/);
  });

  it('still reads the committed template that documents the env contract', () => {
    // The reason the rule lives in the hook rather than in a permission `deny`: a deny
    // rule has no exception syntax, so `Read(./.env.*)` would hide this file too.
    expect(blockReason('.env.example', 'Read')).toBeNull();
    expect(blockReason('.env.example', 'Write')).toBeNull();
  });

  it('leaves reads of the write-protected paths alone', () => {
    // Reading build output or the lockfile costs nothing. Blocking it would turn a
    // secrecy rule into a general obstruction and train the next author to widen it.
    expect(blockReason('dist/index.js', 'Read')).toBeNull();
    expect(blockReason('pnpm-lock.yaml', 'Read')).toBeNull();
    expect(blockReason('src/api/generated/client.ts', 'Read')).toBeNull();
  });

  it('keeps refusing every write it refused before', () => {
    for (const path of [
      '.env',
      '.env.local',
      'pnpm-lock.yaml',
      'dist/index.js',
      'src/api/generated/client.ts',
      'src/api/__generated__/types.ts',
      'src/api/schema.gen.ts',
      '.husky/_/pre-commit',
    ]) {
      expect(blockReason(path, 'Edit')).not.toBeNull();
    }
  });

  it('treats an unknown tool as a write, so a new write tool is covered by default', () => {
    expect(blockReason('dist/index.js', 'mcp__typescript-lsp__edit_file')).not.toBeNull();
  });
});

describe('protected paths — the hook is wired to the read surface', () => {
  const settings = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'settings.json'), 'utf8'),
  );

  it('names Read in the PreToolUse matcher', () => {
    // The hook enforces nothing on a tool the matcher does not admit. Dropping `Read`
    // here reopens the gap silently: every test above still passes.
    const matchers = settings.hooks.PreToolUse.map((entry) => entry.matcher);
    expect(matchers.some((matcher) => /(^|\|)Read(\||$)/.test(matcher))).toBe(true);
  });

  it('denies the shell readers the hook cannot see', () => {
    // Bash payloads carry `command`, not `file_path`, so the hook no-ops on them.
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(['Bash(cat .env:*)', 'Bash(source .env:*)']),
    );
  });
});

/**
 * The MCP credential helper.
 *
 * The point of the helper is that no environment variable holds the Linear key, so the
 * regression to catch is a quiet return to `Bearer ${LINEAR_API_KEY}` — which works
 * identically, and puts the key back where `echo` can reach it.
 */
describe('mcp credential helper', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const mcp = JSON.parse(readFileSync(join(here, '..', '..', '.mcp.json'), 'utf8'));

  it('authenticates Linear through the helper, not through an environment variable', () => {
    const linear = mcp.mcpServers.linear;
    expect(linear.headersHelper).toContain('mcp-headers.mjs');
    // A static header would need the key in Claude Code's env, which every child
    // process inherits. That is the exposure the helper exists to remove.
    expect(linear.headers).toBeUndefined();
    expect(JSON.stringify(mcp)).not.toContain('LINEAR_API_KEY');
  });

  it('names a credential slot, so a sibling repo can hold a different workspace key', () => {
    const slot = mcp.mcpServers.linear.headersHelper.trim().split(/\s+/).at(-1);
    expect(slot).toBe('linear-fro');
    expect(SLOT_PATTERN.test(slot)).toBe(true);
  });

  it('rejects a slot name that could reach the shell as syntax', () => {
    for (const slot of ['', 'a b', "x'; rm -rf /", '../../etc/passwd', 'UPPER', '-lead']) {
      expect(SLOT_PATTERN.test(slot)).toBe(false);
    }
  });

  it('builds the Authorization header the MCP server expects', () => {
    expect(headers('tok')).toEqual({ Authorization: 'Bearer tok' });
  });

  it('reads a per-user credential path rather than anything inside the repo', () => {
    const path = credentialPath('linear-fro', '/home/u').replaceAll('\\', '/');
    expect(path).toBe('/home/u/.claude/mcp-credentials/linear-fro.cred');
  });

  it('escapes a quote in the home path before it reaches PowerShell', () => {
    // A literal `'` would close the PowerShell string and turn the rest into code.
    // Assert the doubling, not the separators — `join` follows the host platform.
    const [, args] = lookupCommand('win32', 'linear-fro', "C:/Users/o'brien");
    expect(args.at(-1)).toContain("o''brien");
  });

  it('uses the platform credential store on each OS', () => {
    expect(lookupCommand('win32', 'linear-fro', '/h')[0]).toBe('powershell');
    expect(lookupCommand('darwin', 'linear-fro', '/h')).toEqual([
      'security',
      ['find-generic-password', '-s', 'claude-mcp-linear-fro', '-w'],
    ]);
    expect(lookupCommand('linux', 'linear-fro', '/h')).toEqual([
      'secret-tool',
      ['lookup', 'service', 'claude-mcp-linear-fro'],
    ]);
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

/**
 * The duplicate-note defences.
 *
 * Every one of these is a failure the shared vault actually collected: a distillation run
 * distilled itself under a fresh session id, and one session that ended twice became two
 * notes. Both are invisible at the time — a wrong note looks exactly like a right one — so
 * they are pinned here rather than left to the next read of the vault.
 */
describe('session learnings — note identity', () => {
  const note = (session, body, date = '2026-01-01 10:00') =>
    `---\ndate: ${date}\nproject: p\nsession: ${session}\nsummary: s\n---\n\n# p — session learnings (${date})\n\n${body}\n`;

  it('reads a flat front-matter field and ignores the body', () => {
    expect(frontMatterValue(note('abc', '## X\n\n- session: not-this'), 'session')).toBe('abc');
    expect(frontMatterValue('no front matter', 'session')).toBe('');
  });

  it('compares notes on their body, not their heading or date', () => {
    // The heading carries the timestamp, so a heading-inclusive comparison would call two
    // identical notes different and defeat the duplicate check entirely.
    expect(noteBody(note('a', '## X\n\n- one', '2026-01-01 10:00'))).toBe(
      noteBody(note('b', '## X\n\n- one', '2026-05-05 22:00')),
    );
  });

  it('rewrites the note this session already has, keeping its name and date', () => {
    const notes = [
      {
        path: '/v/2026-01-01 p aaaaaaaa.md',
        session: 'aaa',
        date: '2026-01-01 10:00',
        body: 'old',
      },
    ];
    const placed = placeNote(notes, 'new', 'aaa', '/v/2026-06-06 p aaaaaaaa.md');
    expect(placed).toEqual({
      target: '/v/2026-01-01 p aaaaaaaa.md',
      date: '2026-01-01 10:00',
      skip: null,
    });
  });

  it('writes nothing when the session ends again having learned nothing new', () => {
    const notes = [{ path: '/v/a.md', session: 'aaa', date: '2026-01-01 10:00', body: 'same' }];
    expect(placeNote(notes, 'same', 'aaa', '/v/new.md').skip).toBe('unchanged: a.md');
  });

  it('writes nothing when another session already holds the same body', () => {
    // The exact shape of the vault's near-copies: distinct session ids, one lesson.
    const notes = [
      {
        path: '/v/2026-01-01 p aaaaaaaa.md',
        session: 'aaa',
        date: '2026-01-01 10:00',
        body: 'same',
      },
    ];
    expect(placeNote(notes, 'same', 'bbb', '/v/new.md').skip).toBe(
      'duplicate of 2026-01-01 p aaaaaaaa.md',
    );
  });

  it('falls back to the dated path for a session it has not seen', () => {
    expect(placeNote([], 'body', 'ccc', '/v/new.md')).toEqual({
      target: '/v/new.md',
      date: '',
      skip: null,
    });
  });

  it('finds the earlier note for this session, and nothing else', () => {
    const notes = [
      { path: '/v/a.md', session: 'aaa', date: '2026-01-01 10:00', body: 'mine' },
      { path: '/v/b.md', session: 'bbb', date: '2026-01-02 10:00', body: 'theirs' },
    ];
    expect(priorBody(notes, 'aaa')).toBe('mine');
    expect(priorBody(notes, 'zzz')).toBe('');
    // An empty session id must not match the notes whose front matter lost theirs.
    expect(priorBody([{ path: '/v/c.md', session: '', date: '', body: 'orphan' }], '')).toBe('');
  });

  it('splits the summary line off the body', () => {
    expect(splitSummary('SUMMARY: topics\n\n## X\n\n- one')).toEqual(['topics', '## X\n\n- one']);
    expect(splitSummary('## X')).toEqual(['', '## X']);
  });
});

describe('session learnings — recursion guard', () => {
  /** One transcript line in the shape Claude Code writes. */
  const entry = (role, content) => JSON.stringify({ message: { role, content } });

  it('recognises a distillation run from its own transcript', () => {
    const raw = [
      entry('user', `${DISTILLER_MARKER}\n\nYou are writing a note for an engineer`),
      entry('assistant', 'SUMMARY: msw handler order'),
    ].join('\n');
    expect(isDistillerTranscript(raw)).toBe(true);
  });

  it('leaves a session that only talks about this hook alone', () => {
    // This repo edits this hook, so the marker turns up as ordinary text in real sessions
    // about it — quoted in the opening question, and again in every tool result that reads
    // the file. Matching it anywhere makes those sessions skip their own note, and a
    // skipped note is indistinguishable from a session that taught nothing.
    const raw = [
      entry('user', `why does ${DISTILLER_MARKER} not stop the duplicate notes?`),
      entry('assistant', `[tool: Read] ${DISTILLER_MARKER}`),
    ].join('\n');
    expect(isDistillerTranscript(raw)).toBe(false);
  });

  it('reads past a leading system entry to find the first user message', () => {
    // The first line of a transcript is not reliably the first user message.
    const raw = [
      JSON.stringify({ type: 'summary', summary: 'earlier session' }),
      entry('assistant', 'caveat text'),
      entry('user', `${DISTILLER_MARKER}\n\nYou are writing a note`),
    ].join('\n');
    expect(isDistillerTranscript(raw)).toBe(true);
  });

  it('does not scan a whole transcript looking for the marker', () => {
    // The bound is what keeps the check cheap on a transcript that runs to megabytes.
    const raw = [
      ...Array.from({ length: 60 }, (_, i) => entry('assistant', `step ${i}`)),
      entry('user', `${DISTILLER_MARKER}\n\nYou are writing a note`),
    ].join('\n');
    expect(isDistillerTranscript(raw)).toBe(false);
  });
});

/**
 * The hook driven end to end, against a stubbed `claude` on PATH.
 *
 * The unit tests above cover the decisions; these cover the wiring that carries them —
 * which guard runs before the distiller is paid for, what reaches `_hook.log`, and how
 * many files the vault ends up with. The stub records each call, so "the distiller never
 * ran" is an assertion rather than an inference.
 */
describe('session learnings — end to end', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = mkdtempSync(join(tmpdir(), 'session-learnings-'));
  const bin = join(root, 'bin');
  const calls = join(root, 'calls.log');
  const stubOutput = join(root, 'stub-output.txt');
  const stubInput = join(root, 'stub-input.txt');

  const NOTE =
    'SUMMARY: msw handler order\n\n## Implementation learnings\n\n- MSW matches first, not best.';

  // The prior-note *section*, anchored to its own line. The prompt names the same header
  // inline, to tell the distiller what the section means, so a bare substring test matches
  // every payload and asserts nothing.
  const PRIOR_SECTION = /\r?\n=== NOTE ALREADY WRITTEN FOR THIS SESSION ===\r?\n/;

  // The stub is a shell script, not a Node script. A nested `node` per call is a third
  // process on top of cmd and the hook, and it fails to start on a loaded machine —
  // which reads as a hook bug rather than as the environment it is.
  //
  // It records one line per call — its working directory, so the same line proves both how
  // often the distiller ran and where — and keeps the payload it was sent, so the prompt
  // the hook builds is an assertion rather than an inference. `findstr "^"` is how cmd
  // copies stdin to a file; `cat` is the same thing on a shell that has one.
  mkdirSync(bin, { recursive: true });
  if (process.platform === 'win32') {
    writeFileSync(
      join(bin, 'claude.cmd'),
      '@echo off\r\n>>"%STUB_CALLS%" cd\r\nfindstr "^" >"%STUB_INPUT%"\r\ntype "%STUB_OUTPUT%"\r\n',
      'utf8',
    );
  } else {
    writeFileSync(
      join(bin, 'claude'),
      '#!/bin/sh\npwd >> "$STUB_CALLS"\ncat > "$STUB_INPUT"\ncat "$STUB_OUTPUT"\n',
      {
        encoding: 'utf8',
        mode: 0o755,
      },
    );
  }

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  /** A vault of its own per test, so one test's notes cannot decide another's outcome. */
  function vault(name) {
    const directory = join(root, `vault-${name}`);
    mkdirSync(directory, { recursive: true });
    return {
      directory,
      notes: () => readdirSync(directory).filter((file) => file.endsWith('.md')),
      read: (file) => readFileSync(join(directory, file), 'utf8'),
      log: () =>
        existsSync(join(directory, '_hook.log'))
          ? readFileSync(join(directory, '_hook.log'), 'utf8')
          : '',
    };
  }

  /** A transcript long enough to clear the 500-character floor, with `head` in front. */
  function transcript(name, head = '') {
    const path = join(root, `${name}.jsonl`);
    const lines = head ? [JSON.stringify({ message: { role: 'user', content: head } })] : [];
    for (let i = 0; i < 20; i += 1) {
      lines.push(
        JSON.stringify({
          message: { role: 'assistant', content: `step ${i}: a real session line` },
        }),
      );
    }
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    return path;
  }

  function runHook({ directory, session, transcriptPath, output = NOTE, skip = false }) {
    writeFileSync(stubOutput, output, 'utf8');
    const env = { ...process.env };
    // Case-insensitively on Windows: two PATH keys in one env block is a coin toss.
    for (const key of Object.keys(env)) {
      if (/^(path|claude_learnings_(dir|off|skip))$/i.test(key)) delete env[key];
    }
    env.PATH = `${bin}${delimiter}${process.env.PATH ?? ''}`;
    env.CLAUDE_LEARNINGS_DIR = directory;
    env.STUB_CALLS = calls;
    env.STUB_OUTPUT = stubOutput;
    env.STUB_INPUT = stubInput;
    if (skip) env.CLAUDE_LEARNINGS_SKIP = '1';
    return spawnSync(process.execPath, [join(here, 'session_learnings.mjs')], {
      input: JSON.stringify({ session_id: session, transcript_path: transcriptPath, cwd: root }),
      encoding: 'utf8',
      timeout: 60_000,
      env,
    });
  }

  const stubLines = () =>
    existsSync(calls) ? readFileSync(calls, 'utf8').trim().split(/\r?\n/).filter(Boolean) : [];
  const stubCalls = () => stubLines().length;
  const lastPayload = () => (existsSync(stubInput) ? readFileSync(stubInput, 'utf8') : '');

  it('writes one note for an ordinary session', () => {
    const v = vault('plain');
    runHook({
      directory: v.directory,
      session: 'aaaaaaaa-1111-2222-3333-444444444444',
      transcriptPath: transcript('one'),
    });
    expect(v.notes()).toHaveLength(1);
    expect(v.read(v.notes()[0])).toContain('MSW matches first');
    expect(v.log()).toMatch(/wrote /);
  });

  it('rewrites its own note when the same session ends a second time', () => {
    const v = vault('resumed');
    const session = 'aaaaaaaa-1111-2222-3333-444444444444';
    runHook({ directory: v.directory, session, transcriptPath: transcript('one') });
    const first = v.notes()[0];
    runHook({
      directory: v.directory,
      session,
      transcriptPath: transcript('one-again'),
      output:
        'SUMMARY: msw handler order\n\n## Implementation learnings\n\n- MSW matches first. Also: onUnhandledRequest.',
    });
    // Same file, not a second dated copy — the failure that put one session in the vault twice.
    expect(v.notes()).toEqual([first]);
    expect(v.read(first)).toContain('onUnhandledRequest');
    expect(v.log()).toMatch(/rewrote /);
  });

  it('sends the earlier note back when it rewrites, so the rewrite cannot lose it', () => {
    // The rewrite replaces the file, and the transcript we send is only the tail of the
    // session. Without the earlier note in the payload, deduplication trades duplicate
    // notes for silent loss: the second distillation overwrites the first lesson.
    const v = vault('carry-forward');
    const session = 'ffffffff-1111-2222-3333-444444444444';
    runHook({
      directory: v.directory,
      session,
      transcriptPath: transcript('first'),
      output: 'SUMMARY: first\n\n## Implementation learnings\n\n- the first lesson',
    });
    runHook({ directory: v.directory, session, transcriptPath: transcript('second') });

    const payload = lastPayload();
    expect(payload).toMatch(PRIOR_SECTION);
    expect(payload).toContain('- the first lesson');
    // The body only. Handing the `summary:` line back invites it into the note.
    expect(payload).not.toContain('summary: first');
  });

  it('sends no prior-note section for a session the vault has not seen', () => {
    const v = vault('no-prior');
    runHook({
      directory: v.directory,
      session: '99999999-1111-2222-3333-444444444444',
      transcriptPath: transcript('fresh'),
    });
    expect(lastPayload()).not.toMatch(PRIOR_SECTION);
  });

  it('runs the distiller outside the repository', () => {
    // `claude -p` files its transcript under the project directory for its cwd. Started in
    // the repo, the child drops a transcript beside the real ones and fires this repo's
    // own SessionEnd when it finishes.
    const v = vault('distiller-home');
    runHook({
      directory: v.directory,
      session: '88888888-1111-2222-3333-444444444444',
      transcriptPath: transcript('elsewhere'),
    });
    const cwd = stubLines().at(-1) ?? '';
    expect(cwd.replaceAll('\\', '/')).toContain('.claude/learnings-distiller');
    expect(cwd).not.toBe(root);
  });

  it('keeps the original date and records the later end when it rewrites', () => {
    const v = vault('dated');
    writeFileSync(
      join(v.directory, '2026-01-01 old bbbbbbbb.md'),
      '---\ndate: 2026-01-01 09:00\nproject: old\nsession: bbbbbbbb-1111-2222-3333-444444444444\nsummary: s\n---\n\n# old — session learnings (2026-01-01 09:00)\n\nfirst body\n',
      'utf8',
    );
    runHook({
      directory: v.directory,
      session: 'bbbbbbbb-1111-2222-3333-444444444444',
      transcriptPath: transcript('older'),
      output: 'SUMMARY: later\n\n## Implementation learnings\n\n- second body',
    });
    const text = v.read('2026-01-01 old bbbbbbbb.md');
    expect(frontMatterValue(text, 'date')).toBe('2026-01-01 09:00');
    expect(frontMatterValue(text, 'updated')).not.toBe('');
    expect(text).toContain('second body');
  });

  it('writes no second copy when another session distilled the same lesson', () => {
    const v = vault('twins');
    runHook({
      directory: v.directory,
      session: 'aaaaaaaa-1111-2222-3333-444444444444',
      transcriptPath: transcript('one'),
    });
    runHook({
      directory: v.directory,
      session: 'cccccccc-1111-2222-3333-444444444444',
      transcriptPath: transcript('twin'),
    });
    expect(v.notes()).toHaveLength(1);
    expect(v.log()).toMatch(/duplicate of /);
  });

  it('skips a distillation run without paying for a second one', () => {
    const v = vault('recursion');
    const before = stubCalls();
    const result = runHook({
      directory: v.directory,
      session: 'dddddddd-1111-2222-3333-444444444444',
      transcriptPath: transcript('distiller', `${DISTILLER_MARKER}\n\nYou are writing a note for`),
    });
    expect(result.status).toBe(0);
    expect(v.notes()).toHaveLength(0);
    // The guard runs before the spawn: recursion that still costs a model call is half fixed.
    expect(stubCalls()).toBe(before);
    expect(v.log()).toMatch(/transcript marker/);
  });

  it('skips when the environment guard is set, and says so in the log', () => {
    const v = vault('env-guard');
    runHook({
      directory: v.directory,
      session: 'eeeeeeee-1111-2222-3333-444444444444',
      transcriptPath: transcript('guarded'),
      skip: true,
    });
    expect(v.notes()).toHaveLength(0);
    expect(v.log()).toMatch(/env guard/);
  });
});
