#!/usr/bin/env node
/**
 * `headersHelper` for the remote MCP servers in `.mcp.json`.
 *
 * Claude Code runs this at connection time, reads a JSON object of headers from stdout,
 * and merges it into the request. It re-runs the helper on reconnect, and on a 401 or
 * 403 it re-runs and retries the call once. The model never sees stdout — the harness
 * consumes it — so the token stays out of the transcript.
 *
 * **Why this exists instead of `"Authorization": "Bearer ${LINEAR_API_KEY}"`.** A `${VAR}`
 * header needs the key in Claude Code's own environment. The Bash tool is a child
 * process and inherits it, so `echo $LINEAR_API_KEY` prints the key, and a key printed
 * into a transcript has to be rotated. Reading from the OS credential store instead
 * means the variable does not exist, so no careless command can find it.
 *
 * **This does not put the key out of reach.** Bash runs as the same user and can run the
 * same lookup this script runs. What it removes is the *ambient* copy — the one that
 * leaks by accident, which is the way this repo lost a key before. Deliberate retrieval
 * still works and is still gated by the permission prompt. See `docs/secrets.md`.
 *
 * Usage: `node .claude/mcp-headers.mjs <slot>`
 *
 * `<slot>` names the credential rather than the provider, so two repos can hold two keys
 * for the same service. That is what binds this repo to the FRO Linear workspace while
 * `python-harness` keeps its own, without either being able to drift the other.
 */

import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Slot names come from committed config, but they reach a shell, so they are validated
 * rather than trusted. Lowercase, digits and dashes only.
 */
export const SLOT_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Where the DPAPI-encrypted credential for `slot` lives on Windows. */
export function credentialPath(slot, home = homedir()) {
  return join(home, '.claude', 'mcp-credentials', `${slot}.cred`);
}

/**
 * The lookup command for a platform, as `[command, args]`.
 *
 * Windows has no credential CLI that prints a password, so the value is stored as a
 * DPAPI-encrypted string. `ConvertFrom-SecureString` binds it to this user on this
 * machine: the file is inert to anyone else, and to this user on another machine.
 */
export function lookupCommand(platform, slot, home = homedir()) {
  if (platform === 'win32') {
    // Single quotes make a PowerShell literal, where `'` is escaped by doubling.
    const path = credentialPath(slot, home).replaceAll("'", "''");
    const script = [
      "$ErrorActionPreference='Stop'",
      `$enc=(Get-Content -Raw -LiteralPath '${path}').Trim()`,
      '$sec=ConvertTo-SecureString $enc',
      '$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)',
      'try{[Runtime.InteropServices.Marshal]::PtrToStringAuto($b)}' +
        'finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}',
    ].join('; ');
    return ['powershell', ['-NoProfile', '-NonInteractive', '-Command', script]];
  }
  if (platform === 'darwin') {
    return ['security', ['find-generic-password', '-s', `claude-mcp-${slot}`, '-w']];
  }
  return ['secret-tool', ['lookup', 'service', `claude-mcp-${slot}`]];
}

/**
 * The headers Claude Code merges into the connection.
 *
 * Exported so a test can assert the shape without a real credential existing.
 */
export function headers(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * A credential short enough to be a mistake rather than a key.
 *
 * An empty read would emit `Bearer ` and fail at the API with an opaque 401, which
 * reads as "the key is wrong" rather than "the store is empty".
 */
const MINIMUM_LENGTH = 8;

/**
 * Write a diagnostic and exit non-zero.
 *
 * Diagnostics name the slot and never the value. This runs with the credential in
 * scope, so anything it prints is a candidate for a log the user later pastes.
 */
function fail(message) {
  process.stderr.write(`mcp-headers: ${message}\n`);
  return 1;
}

function main(argv, platform = process.platform) {
  const slot = argv[2] ?? '';
  if (!SLOT_PATTERN.test(slot)) {
    return fail('usage: mcp-headers.mjs <slot>, where slot is lowercase letters, digits, dashes');
  }

  const [command, args] = lookupCommand(platform, slot);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 8000, // Claude Code gives the helper 10s; fail inside that, not at it.
    windowsHide: true,
  });

  if (result.error) return fail(`could not run ${command} for slot "${slot}"`);
  if (result.status !== 0) return fail(`no credential stored for slot "${slot}"`);

  const token = (result.stdout ?? '').trim();
  if (token.length < MINIMUM_LENGTH) {
    return fail(`credential for slot "${slot}" is empty or truncated; store it again`);
  }

  process.stdout.write(JSON.stringify(headers(token)));
  return 0;
}

// Run only when invoked directly. The test suite imports this module for the pure
// helpers above, and reading a credential on import would need a real one to exist.
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv));
}
