/**
 * Tests for this repository's half of the enforcement layer, and for the two manifests that
 * describe this repo to something outside it.
 *
 * The hooks are layer A now — one Node implementation in `harness`, vendored under
 * `.agents/vendor/harness/hooks/`. What they *do* is tested there, by a suite this file runs
 * rather than duplicates. What stays here is the half that is irreducibly this repo's, and it
 * fails silently in exactly the way it always did:
 *
 * - **The config.** The hooks read every path they act on from `harness.config.json`. A
 *   dropped entry does not error; the Stop gate simply stops watching that directory, and a
 *   narrower gate looks exactly like a passing one.
 * - **The wiring.** A hook matcher is a case-sensitive regex over the tool name. Narrowing one
 *   disables its guard with no signal at all.
 * - **The manifests.** `transform.json` names paths and goes stale in silence; `.mcp.json`
 *   names servers that `.claude/settings.json` has to agree with.
 *
 * Asserted against literals rather than against the constants under test. Reading the same
 * list the hook reads would make a dropped entry pass vacuously — which is the whole failure
 * this file exists to catch.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(repositoryRoot, 'harness.config.json'), 'utf8'));
const settings = JSON.parse(readFileSync(join(repositoryRoot, '.claude', 'settings.json'), 'utf8'));
const codex = JSON.parse(readFileSync(join(repositoryRoot, '.codex', 'hooks.json'), 'utf8'));
const hooksDirectory = join(repositoryRoot, '.agents', 'vendor', 'harness', 'hooks');

/**
 * Run layer A's own suite as part of this repo's Definition of Done.
 *
 * The meta-repo's cross-stack job asks whether a *new* layer A breaks this stack. This asks
 * the other half: whether the layer A this stack has pinned still works here, on this
 * platform. CI runs the gates on Windows as well as Linux, and the hooks are full of
 * platform-specific decisions — shell quoting, path separators, text decoding — that only a
 * Windows run actually checks.
 *
 * Shelled out rather than imported. The suite is written against `node:test`, because it also
 * has to run in a repo with no pnpm and in a vendored tree no package manager has visited;
 * Vitest cannot collect it, which is why `vite.config.ts` excludes the directory.
 */
describe('the shared hooks', () => {
  it('passes its own suite against this checkout', () => {
    const suite = join(hooksDirectory, 'hooks.test.mjs');
    expect(existsSync(suite), 'the vendored layer A ships no hook suite — run vendor_sync').toBe(
      true,
    );

    const result = spawnSync(process.execPath, ['--test', suite], {
      cwd: hooksDirectory,
      encoding: 'utf8',
      timeout: 300_000,
      windowsHide: true,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status, output.trim().split('\n').slice(-30).join('\n')).toBe(0);
  });
});

// `main` is generated from this branch by `.agents/transform/`. The manifest names paths,
// so it goes stale silently: a skill added here without a pointer entry is simply left as a
// stub on `main`, telling the agent to read a file that branch does not have. The generator
// itself is Python and only runs in the generate-main job; these checks are Node, so they
// run everywhere the rest of the suite does — including the Windows leg.
// `.agents/skills/` holds two kinds of directory now. A **repo-owned** skill has its body
// here and needs a `.claude/skills` pointer so Claude Code sees it. A **layer A stub** is an
// address: one line pointing into the vendored tree, present only so a harness that
// discovers skills by directory can find the shared one. On `main` the plugin supplies the
// real thing, so a stub must have no pointer at all — one would materialise a second copy
// under the same name, and nothing would say which of the two answers.
function isLayerAStub(path) {
  return readFileSync(path, 'utf8').includes('.agents/vendor/harness');
}

describe('main-branch transform manifest', () => {
  const manifest = JSON.parse(
    readFileSync(join(repositoryRoot, '.agents', 'transform', 'transform.json'), 'utf8'),
  );

  it('names a canonical target for every pointer stub, and the stub says so too', () => {
    for (const [stub, target] of Object.entries(manifest.pointers)) {
      const stubPath = join(repositoryRoot, stub);
      expect(existsSync(stubPath), `missing stub ${stub}`).toBe(true);
      expect(readFileSync(stubPath, 'utf8'), `${stub} does not name ${target}`).toContain(target);
      expect(existsSync(resolve(dirname(stubPath), target)), `${stub} → missing target`).toBe(true);
    }
  });

  it('covers every repo-owned skill, so a new one cannot ship as a stub on main', () => {
    const root = join(repositoryRoot, '.agents', 'skills');
    const owned = readdirSync(root).filter(
      (name) =>
        existsSync(join(root, name, 'SKILL.md')) && !isLayerAStub(join(root, name, 'SKILL.md')),
    );
    const covered = Object.keys(manifest.pointers).map((stub) => stub.split('/')[2]);
    expect(covered.sort()).toEqual(owned.sort());
  });

  // The other direction, and the one that fails silently. `vendor_sync sync` writes the
  // vendored tree but not these stubs, so a skill added to layer A arrives here with
  // nothing pointing at it — and a harness that discovers skills by directory simply does
  // not have that command, with no error anywhere saying why.
  it('gives every layer A command and skill a discoverable stub', () => {
    const vendor = join(repositoryRoot, '.agents', 'vendor', 'harness');
    const shared = [
      ...readdirSync(join(vendor, 'commands')).map((file) => file.replace(/\.md$/, '')),
      ...readdirSync(join(vendor, 'skills')).filter((name) =>
        existsSync(join(vendor, 'skills', name, 'SKILL.md')),
      ),
    ];
    expect(shared.length, 'no layer A vendored -- run vendor_sync.py sync').toBeGreaterThan(0);

    const stubs = new Set(
      readdirSync(join(repositoryRoot, '.agents', 'skills')).filter((name) =>
        existsSync(join(repositoryRoot, '.agents', 'skills', name, 'SKILL.md')),
      ),
    );
    const missing = shared.filter((name) => !stubs.has(name));
    expect(missing, 'layer A with no stub under .agents/skills/').toEqual([]);
  });

  it('gives layer A no pointer, so the plugin is the only copy on main', () => {
    const root = join(repositoryRoot, '.agents', 'skills');
    const stubs = readdirSync(root).filter(
      (name) =>
        existsSync(join(root, name, 'SKILL.md')) && isLayerAStub(join(root, name, 'SKILL.md')),
    );
    expect(stubs.length, 'no layer A stubs found -- run vendor_sync.py sync').toBeGreaterThan(0);

    const covered = new Set(Object.keys(manifest.pointers).map((stub) => stub.split('/')[2]));
    const shadowing = stubs.filter((name) => covered.has(name));
    expect(shadowing, 'layer A stubs with a pointer would shadow the plugin').toEqual([]);
  });

  it('drops only paths this branch actually has', () => {
    for (const path of manifest.drop) {
      expect(existsSync(join(repositoryRoot, path)), `drop: ${path} is gone`).toBe(true);
    }
  });
});
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

  it('maps every repo-owned skill to a Claude adapter with matching discovery metadata', () => {
    const skillNames = readdirSync(skillRoot).filter(
      (name) =>
        existsSync(join(skillRoot, name, 'SKILL.md')) &&
        !isLayerAStub(join(skillRoot, name, 'SKILL.md')),
    );
    expect(skillNames.length, 'no repo-owned skills left to check').toBeGreaterThan(0);

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

    // The planning adapters are layer A now, so the paths that must agree on the plans
    // directory live in the vendored tree. Checking them there is the point: a layer A
    // change that reintroduced `.claude/plans` would reach this repo through a sync, and
    // nothing else here would notice.
    for (const path of [
      '.agents/vendor/harness/commands/plan.md',
      '.agents/vendor/harness/commands/implement-from-plan.md',
      '.agents/vendor/harness/agents/spec-checker.md',
      '.agents/vendor/harness/workflows/full-review.js',
      'docs/agents/planning.md',
    ]) {
      expect(readFileSync(join(repositoryRoot, path), 'utf8')).not.toContain('.claude/plans');
    }
  });

  // A harness-neutral repo that wires a lifecycle event for one harness and not the other
  // is agnostic in its documentation only. SessionEnd was missing here while the Claude
  // side had it, so Codex sessions distilled nothing and said nothing about it. Which
  // scripts each adapter runs is asserted in `hook wiring` below, against both configs at
  // once; this is the narrower property that the two adapters cover the same events.
  it('gives Codex every lifecycle event the Claude harness has', () => {
    expect(Object.keys(codex.hooks).sort()).toEqual(Object.keys(settings.hooks).sort());
  });
});

/**
 * What the Stop gate watches.
 *
 * This was `GATED_PATHS` / `GATED_FILES` / `GATED_EXTENSIONS` in `verify.mjs`, pinned here
 * against literals for the same reason it is pinned now: the hook reads the list, so reading
 * the list back would prove nothing. A dropped entry is invisible — git simply stops
 * reporting that directory and the gate goes quiet.
 */
describe('Stop-gate pathspec', () => {
  const hooks = config.hooks;

  it('covers the application, its specs and the hooks that enforce the gates', () => {
    for (const path of ['src', 'e2e', '.agents/vendor/harness/hooks']) {
      expect(hooks.gatedPaths, `${path} is not gated`).toContain(path);
    }
  });

  it('gates every source extension the toolchain reads', () => {
    // `.css` is in because `format:check` covers it and Tailwind layers live there. `.mjs`
    // is in because the vendored hooks are `.mjs` — without it, editing one ends the turn
    // ungated, which is the enforcement layer escaping its own gate a second time.
    for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']) {
      expect(hooks.gatedExtensions, `${extension} is not gated`).toContain(extension);
    }
  });

  it('covers the config files that define the gates', () => {
    for (const file of [
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
    ]) {
      expect(hooks.gatedFiles, `${file} is not gated`).toContain(file);
    }
  });

  it('covers the files that configure the harness itself', () => {
    // `.mcp.json` is under no gated path, and `harness.config.json` now declares the gates
    // *and* what the guards protect — so a bad edit to it disables the whole enforcement
    // layer while touching no application code.
    for (const file of ['.mcp.json', '.claude/settings.json', 'harness.config.json']) {
      expect(hooks.gatedFiles, `${file} is not gated`).toContain(file);
    }
  });

  it('keeps the production build in the gate set', () => {
    // Only the build checks the browser target. A top-level `await` passes `typecheck` and
    // still fails `vite build` against es2020 — that class of break escaped to CI once.
    expect(config.gates.map((gate) => gate.kind)).toContain('build');
  });

  it('leaves prose ungated so writing work never burns override budget', () => {
    expect(hooks.gatedExtensions).not.toContain('.md');
    expect(hooks.gatedFiles.filter((file) => file.endsWith('.md'))).toEqual([]);
  });
});

/**
 * What the guards refuse, and what they deliberately do not.
 */
describe('protected paths', () => {
  const globs = config.hooks.protected.map((entry) => entry.glob);

  it('refuses a write to every generated tree this repo produces', () => {
    for (const glob of [
      'pnpm-lock.yaml',
      'dist/**',
      '**/generated/**',
      '**/__generated__/**',
      '**/*.gen.ts',
      '.husky/_/**',
      // Editing a vendored file is the drift the freshness check exists to catch. Refusing
      // the write beats reporting it a commit later.
      '.agents/vendor/**',
    ]) {
      expect(globs, `${glob} is not protected`).toContain(glob);
    }
  });

  it('leaves `.env` to the hook, which cannot be talked out of it', () => {
    // `protect_paths.mjs` carries the `.env` rules as a built-in floor. A guard whose config
    // goes missing and quietly protects nothing is worse than no guard, because the repo
    // still reads as protected. Declaring them here would suggest they could be undeclared.
    expect(globs.filter((glob) => glob.startsWith('.env'))).toEqual([]);
  });

  it('says what to do instead, in every refusal', () => {
    // The `why` is the whole message the agent receives. "regenerate with `pnpm install`"
    // ends the attempt; "protected" invites a retry with a different tool.
    for (const entry of config.hooks.protected) {
      expect(entry.why, `${entry.glob} gives no reason`).toBeTruthy();
      expect(entry.why.length, `${entry.glob}: ${entry.why} is not a reason`).toBeGreaterThan(20);
    }
  });

  it('still reads the committed template that documents the env contract', () => {
    // The exception a permission `deny` rule cannot express: `Read(./.env.*)` would also hide
    // `.env.example`. `.env.example` is exempt in the hook by default, so nothing here should
    // re-deny it.
    expect(JSON.stringify(settings.permissions.deny)).not.toContain('.env.example');
  });
});

/**
 * Formatting is advisory, but *what* gets formatted is not: a repo whose format gate covers
 * Markdown and JSON has to list them here, or a doc edit skips formatting now and fails the
 * gate later in a session that never touched it.
 */
describe('formatters', () => {
  const formatted = config.hooks.formatters.flatMap((entry) => entry.match);

  it('covers every extension Prettier owns here, not only the gated ones', () => {
    for (const extension of [
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
    ]) {
      expect(formatted, `${extension} is never formatted after an edit`).toContain(extension);
    }
  });

  it('autofixes with ESLint only where ESLint can', () => {
    const eslint = config.hooks.formatters.filter((entry) =>
      entry.run.some((argv) => argv.includes('eslint')),
    );
    expect(eslint.flatMap((entry) => entry.match).sort()).toEqual(['.ts', '.tsx']);
  });
});

/**
 * Which tool calls each guard actually sees.
 *
 * A hook matcher is a case-sensitive regex over the **tool name**. Every guard depends on it
 * entirely: the write guard cannot block a write it never sees, the formatter cannot format a
 * file it is never told about, and the secret guard cannot refuse a read that never reaches
 * it. Narrowing a matcher disables its guard silently — every other test still passes.
 *
 * Asserted per guard rather than per event, because the two things `PreToolUse` carries want
 * opposite answers from the same event: the formatter must not fire on reads, and the secret
 * guard must. Asserting the event as a whole is what let the Python side's read guard ship
 * wired into one harness and nowhere else — nothing could tell, because "PreToolUse ignores
 * reads" was the property being asserted.
 */
describe('hook wiring', () => {
  const configs = [
    ['claude', settings],
    ['codex', codex],
  ];

  const matchers = (source, event, script) =>
    (source.hooks[event] ?? [])
      .filter((group) => group.matcher && JSON.stringify(group.hooks).includes(script))
      .map((group) => group.matcher);

  const WRITE_TOOLS = [
    'Edit',
    'Write',
    'NotebookEdit',
    'mcp__filesystem__write_file',
    'mcp__filesystem__edit_file',
    'mcp__memory__create_entities',
    'mcp__patch__apply_patch',
  ];

  it.each(configs)('%s: covers every tool that can write a file', (_name, source) => {
    for (const tool of WRITE_TOOLS) {
      for (const [event, script] of [
        ['PreToolUse', 'protect_paths.mjs'],
        ['PostToolUse', 'format_edited.mjs'],
      ]) {
        const found = matchers(source, event, script);
        expect(
          found.some((pattern) => new RegExp(pattern).test(tool)),
          `the ${script} matcher does not cover ${tool}. Matchers: ${found}`,
        ).toBe(true);
      }
    }
  });

  it.each(configs)('%s: covers every route a secret can leave by', (_name, source) => {
    for (const tool of ['Read', 'Bash']) {
      const found = matchers(source, 'PreToolUse', 'protect_paths.mjs');
      expect(
        found.some((pattern) => new RegExp(pattern).test(tool)),
        `a secret can be reached through ${tool} without the guard seeing the call`,
      ).toBe(true);
    }
  });

  it.each(configs)('%s: does not run the formatter on a read', (_name, source) => {
    for (const tool of ['Read', 'Grep', 'Glob', 'Bash']) {
      const found = matchers(source, 'PostToolUse', 'format_edited.mjs');
      expect(
        found.some((pattern) => new RegExp(pattern).test(tool)),
        `the formatter fires on the read-only tool ${tool}`,
      ).toBe(false);
    }
  });

  it.each(configs)('%s: still wires every lifecycle event', (_name, source) => {
    // The assertions above pass vacuously if a guard is deleted: `some([])` is false, so the
    // read-only check holds and only the coverage check is left to fail. Pin each event
    // separately so removing one reports as removal.
    for (const event of ['PreToolUse', 'PostToolUse', 'Stop', 'SessionEnd']) {
      expect(source.hooks[event]?.length, `no ${event} hook is configured at all`).toBeTruthy();
    }
  });

  it.each(configs)('%s: points every hook into the vendored layer A', (_name, source) => {
    const wiring = JSON.stringify(source.hooks);
    expect(wiring, 'a hook still points at the deleted local scripts').not.toContain(
      '.claude/hooks/',
    );
    for (const script of ['protect_paths.mjs', 'format_edited.mjs', 'verify.mjs']) {
      expect(wiring, `${script} is not wired`).toContain(`vendor/harness/hooks/${script}`);
    }
  });

  it('detaches the Codex session distillation from the three-second budget', () => {
    // `claude -p` takes minutes; Codex gives SessionEnd three seconds. Running the distiller
    // inline there means it is killed every time, and a killed distiller looks exactly like a
    // session that taught nothing.
    const [hook] = codex.hooks.SessionEnd[0].hooks;
    expect(hook.command).toContain('codex_session_learnings.mjs');
    expect(hook.command).not.toContain('/session_learnings.mjs');
    expect(hook.timeout).toBe(3);
  });

  it('gives every Codex hook a Windows variant', () => {
    // `$(...)` is not command substitution in `cmd.exe`. Without the variant the hook never
    // starts, and a hook that cannot start is a hook that silently stops enforcing.
    for (const [event, groups] of Object.entries(codex.hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          expect(hook.commandWindows, `${event} has no Windows command`).toBeTruthy();
        }
      }
    }
  });
});

/**
 * The second brain.
 *
 * This repo used to ship no indexer at all, deliberately: an indexer in both repos is one
 * artifact with two writers, and that pair re-diverged on a header line inside a single fix
 * cycle with only one side under test. The cost was a lag — notes written here were invisible
 * to search until a session ended in `python-harness`.
 *
 * Layer A ends the trade rather than choosing a side of it. There is one implementation, in
 * one place, and both repos run it. What must not come back is a *local* one.
 */
describe('second brain', () => {
  it('ships no indexer of its own to drift against the shared one', () => {
    const local = readdirSync(join(repositoryRoot, '.agents'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'vendor')
      .flatMap((entry) =>
        readdirSync(join(repositoryRoot, '.agents', entry.name), { recursive: true }).map(
          (name) => `${entry.name}/${name}`,
        ),
      );
    expect(local.filter((name) => /vault_index|session_learnings/.test(String(name)))).toEqual([]);
  });

  it('writes and indexes through the same shared code', () => {
    for (const script of ['session_learnings.mjs', 'vault_index.mjs']) {
      expect(existsSync(join(hooksDirectory, script)), `${script} is not vendored`).toBe(true);
    }
    expect(JSON.stringify(settings.hooks.SessionEnd)).toContain('session_learnings.mjs');
  });
});
