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
 * **Every run appends one outcome line to `_hook.log`** beside the notes. SessionEnd
 * stderr is invisible, so before the log a failed distillation looked identical to a
 * session that taught nothing. Diagnosis: no line for a session means SessionEnd never
 * fired — a closed terminal window skips it; a `failed:` line names the reason.
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
 *
 * **This hook writes notes. It does not index them.** `python-harness` owns both vault
 * indexes — `_VAULT_INDEX.md` and `Project Learnings/_INDEX.md` — and rebuilds them when a
 * session ends there. That is deliberate: an indexer in both repos is one artifact with two
 * writers, and this repo already watched that pair re-diverge on a header line inside a
 * single fix cycle, with only one side under test. One implementation cannot disagree with
 * itself.
 *
 * The cost is a lag. Notes written from this repo do not appear in either index until a
 * session ends in `python-harness`. `/search-second-brain` is built for that: it greps the
 * vault as well as reading the indexes, precisely so a stale index degrades the search
 * instead of silently truncating it.
 *
 * The recursion guard matters: the `claude -p` we spawn fires its own SessionEnd when it
 * finishes. Without the guard that is an infinite regress of sessions distilling sessions.
 *
 * Never blocks. Every failure path exits 0 — a second brain that cannot be written is not
 * a reason to interfere with ending a session.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { output, readPayload } from './lib.mjs';

const MODEL = process.env.CLAUDE_LEARNINGS_MODEL ?? 'sonnet';
const NO_LEARNINGS = 'NO_LEARNINGS';
const SUMMARY_PREFIX = 'SUMMARY:';

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

/**
 * Append one outcome line to `_hook.log` beside the notes. SessionEnd stderr goes nowhere a
 * user looks, so without this a failed distillation and a session that taught nothing are
 * indistinguishable — both leave no note. The log makes the difference readable: no line
 * means the hook never fired; a `failed:` line names the reason. Never blocks.
 */
function logOutcome(directory, project, outcome) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  try {
    appendFileSync(join(directory, '_hook.log'), `${stamp} ${project}: ${outcome}\n`, 'utf8');
  } catch {
    // A log that cannot be written is not a reason to interfere with ending a session.
  }
}

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

/**
 * Ask a headless Claude for the lessons. Returns `{ text, failure }`: empty text with a
 * null failure means the session taught nothing; a non-null failure names what broke, so
 * the log can tell the two apart.
 */
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
    return { text: '', failure: `could not run claude (${result.error.message})` };
  }
  if (result.status !== 0) {
    return { text: '', failure: `claude exited ${result.status}` };
  }
  const text = (result.stdout ?? '').trim();
  if (!text) return { text: '', failure: 'distiller returned empty output' };
  if (text.startsWith(NO_LEARNINGS)) return { text: '', failure: null };
  return { text, failure: null };
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

async function main() {
  if (process.env.CLAUDE_LEARNINGS_SKIP === '1') return 0; // The distiller's own session.
  if (process.env.CLAUDE_LEARNINGS_OFF === '1') return 0;

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
  const project = basename(cwd) || 'session';
  const transcript = readTranscript(payload.transcript_path ?? '');
  if (transcript.length < 500) {
    logOutcome(directory, project, 'skipped: transcript under 500 chars');
    return 0;
  }

  const { text: distilled, failure } = distil(transcript, gitContext(cwd));
  if (failure) {
    process.stderr.write(`session_learnings: ${failure}\n`);
    logOutcome(directory, project, `failed: ${failure}`);
    return 0;
  }
  if (!distilled) {
    logOutcome(directory, project, 'no learnings: the session taught nothing');
    return 0;
  }

  const [summary, text] = splitSummary(distilled);
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
    logOutcome(directory, project, `failed: could not write note (${error.message})`);
    return 0;
  }

  // No index rebuild here by design — python-harness owns both indexes. See the note at
  // the top of this file.
  process.stderr.write(`session_learnings: wrote ${target}\n`);
  logOutcome(directory, project, `wrote ${basename(target)}`);
  return 0;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
