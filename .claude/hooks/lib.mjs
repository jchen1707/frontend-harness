/**
 * Shared plumbing for the hooks in this directory.
 *
 * Dependency-free on purpose. Hooks run before `pnpm install` has necessarily
 * happened, and a hook that cannot start is a hook that silently stops enforcing.
 * Node 22 (see `.nvmrc`) is the only requirement.
 */

import { spawnSync } from 'node:child_process';

/**
 * Windows has no executable `pnpm` — only `pnpm.cmd`, which `spawnSync` finds
 * only through a shell. POSIX needs no shell, so it does not get one.
 */
const USE_SHELL = process.platform === 'win32';

/**
 * Characters that change meaning inside `cmd.exe`. Any argument built from a
 * tool payload is checked against this before it reaches a shelled command.
 */
const SHELL_META = /[&|<>^"%!]/;

/** True when `value` is safe to place in a shelled command line. */
export function shellSafe(value) {
  return !SHELL_META.test(value);
}

/**
 * Run a command and return `{ status, stdout, stderr }`.
 *
 * `encoding` is explicit rather than `{ encoding: 'utf8' }` being assumed: the
 * default is a Buffer, and decoding it with the locale codec (cp1252 on Windows)
 * turns every em-dash and curly quote in an ESLint or tsc diagnostic into
 * mojibake — corrupting the exact message the hook exists to echo back.
 *
 * Never throws. A tool that will not start is a tooling problem, and a hook must
 * not convert one into a blocked turn.
 */
export function run(command, args, { cwd, timeout = 120_000 } = {}) {
  const quoted = USE_SHELL ? args.map((a) => (a.includes(' ') ? `"${a}"` : a)) : args;
  const result = spawnSync(command, quoted, {
    cwd: cwd || undefined,
    encoding: 'utf8',
    timeout,
    shell: USE_SHELL,
    windowsHide: true,
  });
  return {
    status: result.error ? null : result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ?? null,
  };
}

/** stdout of a command, or `''` on any non-zero exit or failure to start. */
export function output(command, args, options) {
  const result = run(command, args, options);
  return result.status === 0 ? result.stdout.trim() : '';
}

/** Read the hook payload from stdin. Returns `null` when it is absent or malformed. */
export async function readPayload() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null; // Never block because the hook itself could not parse.
  }
}

/** Repo-relative, forward-slashed form of a path the harness reported. */
export function relativePath(raw, projectDir) {
  let path = raw.replaceAll('\\', '/');
  const root = (projectDir || '').replaceAll('\\', '/').replace(/\/+$/, '');
  if (root && path.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    path = path.slice(root.length + 1);
  }
  // Collapse `./` and `a/../b` without touching a leading dot: stripping "./"
  // with a trim would turn ".env" into "env" and defeat every dotfile rule.
  const parts = [];
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/** The last `count` lines of `text`. */
export function tail(text, count) {
  return text.trim().split(/\r?\n/).slice(-count).join('\n');
}
