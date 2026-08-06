#!/usr/bin/env node
/**
 * SessionEnd hook: distil what the session learned the hard way into the second brain.
 *
 * A hook is a shell command with no model of its own, so it cannot judge which mistakes
 * taught something. This one does the deterministic half — locate the vault, extract the
 * transcript, gather git context, write the file — and shells out to a headless
 * `claude -p` for the one part that needs judgement.
 *
 * **It writes nothing when the session taught nothing.** An empty note is worse than no
 * note: it dilutes the directory every later search has to sift. The distiller is told to
 * emit a single sentinel when there is no real lesson, and that path exits silently.
 *
 * Configure with `CLAUDE_LEARNINGS_DIR` (absolute path to the notes directory). Unset
 * means disabled, which is the right default for a harness other people clone — nobody
 * inherits a path to somebody else's vault. Set it in **user** settings, not this repo's
 * committed `.claude/settings.json`.
 *
 * | Variable | Effect |
 * | --- | --- |
 * | `CLAUDE_LEARNINGS_DIR` | Where notes are written. Unset -> hook does nothing. |
 * | `CLAUDE_LEARNINGS_OFF=1` | Disable without unsetting the directory. |
 * | `CLAUDE_LEARNINGS_MODEL` | Model for the distillation. Default `sonnet`. |
 * | `CLAUDE_LEARNINGS_SKIP=1` | Recursion guard; set on the child, never set by hand. |
 * | `CLAUDE_VAULT_DIR` | Vault root for the whole-vault index. Defaults to the parent of `CLAUDE_LEARNINGS_DIR`. See `vault_index.mjs`. |
 *
 * This hook also refreshes the whole-vault index, and does so **unconditionally** — notes
 * written by hand in Obsidian between sessions need indexing whether or not this
 * particular session produced a learning of its own.
 *
 * The recursion guard matters: the `claude -p` we spawn fires its own SessionEnd when it
 * finishes. Without the guard that is an infinite regress of sessions distilling sessions.
 *
 * Never blocks. Every failure path exits 0 — a second brain that cannot be written is not
 * a reason to interfere with ending a session.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { output, readPayload } from './lib.mjs';
import * as vaultIndex from './vault_index.mjs';

const MODEL = process.env.CLAUDE_LEARNINGS_MODEL ?? 'sonnet';
const NO_LEARNINGS = 'NO_LEARNINGS';
const SUMMARY_PREFIX = 'SUMMARY:';

/**
 * The index is what a search reads first, so it must be cheap. One row per note, and no
 * note bodies. `_INDEX` sorts to the top of the folder and reads as machinery, not as a
 * learning — the same reason `.out-of-scope/README.md` announces that it is not a record.
 */
const INDEX_NAME = '_INDEX.md';

/**
 * The distiller reads text only, so it needs no tools. Cap what we send: transcripts run
 * to megabytes, and the tail is where fixes land.
 */
const MAX_TRANSCRIPT_CHARS = 60_000;
const DISTILL_TIMEOUT = 240_000;

const PROMPT = `You are writing a note for an engineer's personal knowledge base, recording
what a coding session taught them. Someone will read this months from now with no memory
of the session.

Below is a transcript, plus the git context of what changed.

Extract only **technical learnings that came from a mistake, a wrong assumption, or
friction that was then resolved**. The value is in what was believed, why it was wrong,
and what turned out to be true.

Ignore: what the session accomplished, features shipped, files touched, anything that
reads like a changelog. That is recoverable from git. A learning is not.

Split the findings into exactly these two sections:

## Implementation learnings

Low-level and concrete. Tool flags and their real behaviour, API and config semantics,
browser and platform quirks, error messages and what actually causes them, commands that
do not do what their name implies.

## Architecture & design learnings

Higher-level and transferable. Why a structure resisted a change, where a boundary was
drawn wrongly, a design tension and how it resolved, a rule that turned out to have an
exception, a process or workflow that broke down and why.

Rules:
- Every entry states the wrong belief and the correction. "X, not Y — because Z."
- Be specific. Name the tool, flag, file or concept. A vague lesson teaches nothing.
- Omit a section entirely if nothing qualifies. Do not pad it.
- If the session contained no genuine learning of either kind — no mistakes, only
  routine work — reply with exactly \`${NO_LEARNINGS}\` and nothing else.

Start your reply with one line, exactly in this form:

${SUMMARY_PREFIX} <one sentence naming the topics covered, under 25 words>

That line is the only thing a search reads before deciding whether to open this note, so
name the concrete subjects — the tool, the system, the concept. Write "Vitest module
mocking and MSW handler order", not "various tooling lessons".

Then a blank line, then the first \`##\` heading. No other preamble, no closing summary.

Output GitHub-flavoured Markdown. Do not include front matter; it is added for you.`;

/** Branch, recent commits and dirty files — the facts a model should not have to infer. */
function gitContext(cwd) {
  const branch = output('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }) || '(unknown)';
  const log = output('git', ['log', '--oneline', '-15'], { cwd });
  const status = output('git', ['status', '--porcelain'], { cwd });
  const parts = [`Branch: ${branch}`];
  if (log) parts.push(`Recent commits:\n${log}`);
  if (status) parts.push(`Uncommitted:\n${status}`);
  return parts.join('\n\n');
}

/** Pull readable text out of one content block, whatever shape it arrived in. */
function extractText(block) {
  if (typeof block === 'string') return block;
  if (block && typeof block === 'object') {
    if (block.type === 'text' && typeof block.text === 'string') return block.text;
    if (block.type === 'tool_use' && typeof block.name === 'string') return `[tool: ${block.name}]`;
  }
  return '';
}

/** Flatten the transcript JSONL into plain text, keeping the most recent tail. */
function readTranscript(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return '';
  }

  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry?.message;
    if (!message || typeof message !== 'object') continue;
    const content = message.content;
    const blocks = Array.isArray(content) ? content : [content];
    const text = blocks.map(extractText).filter(Boolean).join(' ').trim();
    if (text) lines.push(`${message.role ?? '?'}: ${text}`);
  }

  const joined = lines.join('\n');
  return joined.length > MAX_TRANSCRIPT_CHARS ? joined.slice(-MAX_TRANSCRIPT_CHARS) : joined;
}

/** Ask a headless Claude for the lessons. An empty string means "write nothing". */
function distil(transcript, context) {
  const payload = `${PROMPT}\n\n=== GIT CONTEXT ===\n${context}\n\n=== TRANSCRIPT ===\n${transcript}`;
  const result = spawnSync('claude', ['-p', '--model', MODEL], {
    input: payload,
    // Explicit, not the default Buffer: decoding with the locale codec (cp1252 on
    // Windows) turns the model's em-dashes into mojibake in the written note.
    encoding: 'utf8',
    timeout: DISTILL_TIMEOUT,
    shell: process.platform === 'win32',
    windowsHide: true,
    env: { ...process.env, CLAUDE_LEARNINGS_SKIP: '1' },
  });

  if (result.error) {
    process.stderr.write(`session_learnings: could not distil (${result.error.message})\n`);
    return '';
  }
  if (result.status !== 0) {
    process.stderr.write(`session_learnings: claude exited ${result.status}\n`);
    return '';
  }
  const text = (result.stdout ?? '').trim();
  return !text || text.startsWith(NO_LEARNINGS) ? '' : text;
}

/** Dated, project-scoped, session-suffixed so two sessions a day cannot collide. */
function notePath(directory, project, sessionId) {
  const stamp = new Date().toISOString().slice(0, 10);
  const short = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'session';
  return join(directory, `${stamp} ${project} ${short}.md`);
}

/** Separate the `SUMMARY:` line from the note body. A missing prefix is not fatal. */
export function splitSummary(text) {
  const newline = text.indexOf('\n');
  const first = (newline === -1 ? text : text.slice(0, newline)).trim();
  if (!first.startsWith(SUMMARY_PREFIX)) return ['', text];
  const rest = newline === -1 ? '' : text.slice(newline + 1).replace(/^\n+/, '');
  return [first.slice(SUMMARY_PREFIX.length).trim(), rest];
}

/**
 * Regenerate `_INDEX.md` from every note's front matter.
 *
 * Rebuilt rather than appended. An append-only index drifts the moment a note is edited,
 * renamed or deleted by hand, and a stale index is worse than none — a search that trusts
 * it silently misses notes.
 */
function rebuildIndex(directory) {
  const rows = [];
  let entries;
  try {
    entries = readdirSync(directory).filter((n) => n.endsWith('.md') && n !== INDEX_NAME);
  } catch {
    return;
  }
  for (const name of entries.sort().reverse()) {
    let text;
    try {
      text = readFileSync(join(directory, name), 'utf8');
    } catch {
      continue;
    }
    // One parser, shared with the whole-vault index, so the two cannot disagree about
    // what a note says.
    const fields = vaultIndex.frontMatter(text);
    if (Object.keys(fields).length === 0) continue;
    rows.push([
      fields.date ?? '',
      fields.project ?? '',
      fields.summary ?? '',
      name.replace(/\.md$/, ''),
    ]);
  }

  const lines = [
    '---',
    'tags: [project-learnings-index]',
    '---',
    '',
    '# Learnings index',
    '',
    'Generated by the `SessionEnd` hook. Do not edit: it is rebuilt on every write.',
    '',
    'Search this file first, then open only the notes whose summary matches. Reading',
    'every note to answer one question is the cost this index exists to avoid.',
    '',
    `${rows.length} notes.`,
    '',
    '| Date | Project | Summary | Note |',
    '| --- | --- | --- | --- |',
  ];
  for (const [date, project, summary, stem] of rows) {
    lines.push(`| ${date} | ${project} | ${summary.replaceAll('|', '\\|')} | [[${stem}]] |`);
  }

  try {
    writeFileSync(join(directory, INDEX_NAME), `${lines.join('\n')}\n`, 'utf8');
  } catch (error) {
    process.stderr.write(`session_learnings: could not write index (${error.message})\n`);
  }
}

async function main() {
  if (process.env.CLAUDE_LEARNINGS_SKIP === '1') return 0; // The distiller's own session.
  if (process.env.CLAUDE_LEARNINGS_OFF === '1') return 0;

  // Unconditional, and before every early return below: the vault gains hand-written
  // notes between sessions, and those need indexing even when this session distilled
  // nothing. Returns null and stays quiet when no vault is configured.
  vaultIndex.refresh();

  const directory = (process.env.CLAUDE_LEARNINGS_DIR ?? '').trim();
  if (!directory) return 0; // Not configured -> not this clone's business.

  try {
    if (!statSync(directory).isDirectory()) throw new Error('not a directory');
  } catch {
    process.stderr.write(`session_learnings: ${directory} is not a directory\n`);
    return 0;
  }

  const payload = await readPayload();
  if (!payload) return 0;

  const cwd = payload.cwd || process.cwd();
  const transcript = readTranscript(payload.transcript_path ?? '');
  if (transcript.length < 500) return 0; // Too short to have taught anything.

  const distilled = distil(transcript, gitContext(cwd));
  if (!distilled) return 0;

  const [summary, text] = splitSummary(distilled);
  const project = basename(cwd) || 'session';
  const sessionId = String(payload.session_id ?? '');
  const target = notePath(directory, project, sessionId);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const front =
    '---\n' +
    `date: ${stamp}\n` +
    `project: ${project}\n` +
    `session: ${sessionId}\n` +
    `summary: ${summary}\n` +
    'tags: [project-learnings, session-retro]\n' +
    '---\n\n' +
    `# ${project} — session learnings (${stamp})\n\n`;

  try {
    writeFileSync(target, `${front}${text}\n`, 'utf8');
  } catch (error) {
    process.stderr.write(`session_learnings: could not write ${target} (${error.message})\n`);
    return 0;
  }

  rebuildIndex(directory);
  process.stderr.write(`session_learnings: wrote ${target}\n`);
  return 0;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
