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
 * **Two recursion guards, because one is not enough.** The `claude -p` we spawn is a full
 * session and fires its own SessionEnd when it finishes. Its transcript contains the parent
 * transcript verbatim, so distilling it produces a near-copy of the parent's note under a
 * new session id. The vault this hook writes to collected four such copies from the sibling
 * `python-harness` implementation, which carries the same `CLAUDE_LEARNINGS_SKIP` guard —
 * proof that an environment variable crossing a process boundary we do not control is a
 * guard that can leak silently. So the env guard is backed by a second, propagation-free
 * one: the payload we send starts with `DISTILLER_MARKER`, and a transcript whose head
 * carries that marker is a distillation run and is never distilled again.
 *
 * The distiller also runs **outside the repository**, in `DISTILLER_HOME`. `claude -p`
 * files its transcript under the project directory of its cwd, so a distiller started in
 * this repo drops a child transcript beside the real ones and loads this repo's own hooks
 * into the child. A fixed neutral directory does neither.
 *
 * **The note is keyed on the session, not on the clock.** One session can end more than
 * once — resume it, and SessionEnd fires again on a later date. The dated filename made
 * that a second note about the same session. Now an existing note for the same session id
 * is rewritten in place, keeping its original name and `date:` so links and ordering hold.
 *
 * **A rewrite carries the earlier note forward.** The rewrite replaces the file, and the
 * transcript we send holds only the last `MAX_TRANSCRIPT_CHARS`. So the note this session
 * already has goes back to the distiller under `PRIOR_NOTE_HEADER`, and the distiller is
 * told to keep every learning in it. Without that, deduplication trades duplicate notes
 * for silent loss — a resumed session overwrites its own first lesson with its second.
 *
 * **A note whose body already exists verbatim is not written.** That is the last net under
 * both guards, and it costs one directory scan on the write path only.
 *
 * Never blocks. Every failure path exits 0 — a second brain that cannot be written is not
 * a reason to interfere with ending a session.
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
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

/**
 * First line of everything we send to the distiller, so a distillation run is identifiable
 * from its own transcript alone. Change it and the guard stops recognising runs started by
 * the previous version — treat it as a wire format, not a comment.
 */
export const DISTILLER_MARKER = 'SESSION-LEARNINGS-DISTILLER-V1';

/**
 * How many transcript lines the marker check reads before it gives up. The opening prompt
 * is within the first few entries of any transcript, and a real one runs to megabytes.
 */
const MARKER_MAX_LINES = 50;

/**
 * Where the distiller runs. `claude -p` files its transcript under the project directory
 * for its cwd, so running it in the repo drops a child transcript beside the real ones and
 * fires this repo's own SessionEnd hook when the child finishes. A fixed neutral directory
 * does neither. The distiller reads text and uses no tools, so it needs no repository.
 */
const DISTILLER_HOME = join(homedir(), '.claude', 'learnings-distiller');

/** Introduces the note this session already has, when the session is distilled again. */
const PRIOR_NOTE_HEADER = '=== NOTE ALREADY WRITTEN FOR THIS SESSION ===';

const PROMPT = `${DISTILLER_MARKER}

The line above marks this call for the harness. Ignore it. Do not repeat it in your reply.

You are writing a note for an engineer's personal knowledge base, recording
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

If a \`${PRIOR_NOTE_HEADER}\` section follows, it is your own earlier note for this same
session, written from an earlier part of it. Your reply replaces that file. Keep every
learning it holds, and add what the transcript below teaches on top. State each learning
once. The transcript you receive is only the most recent part of the session, so the
earlier note is the only record of what came before it.

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

/** The transcript file as written, or `''` when it cannot be read. */
function readRaw(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Text of the transcript's first user message, or `''` when it has none. Bounded by
 * `MARKER_MAX_LINES`, because the opening prompt sits in the first few entries.
 */
export function firstUserMessage(raw) {
  const lines = raw.split(/\r?\n/, MARKER_MAX_LINES);
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry?.message;
    if (!message || typeof message !== 'object' || message.role !== 'user') continue;
    const content = message.content;
    const blocks = Array.isArray(content) ? content : [content];
    return blocks.map(extractText).filter(Boolean).join(' ').trim();
  }
  return '';
}

/**
 * True when this transcript is a distillation run of ours. The marker opens the payload we
 * send, so it opens the first message the child records.
 *
 * The test is a prefix test on that message, not a search of the file. This repo edits this
 * hook, so the marker appears as ordinary text — in a tool result, a diff, or a pasted
 * quotation — in real sessions about it. Searching for it anywhere would make those
 * sessions skip their own note, and a skipped note looks exactly like a session that
 * taught nothing. Only a session whose opening prompt *is* the distillation prompt counts.
 */
export function isDistillerTranscript(raw) {
  return firstUserMessage(raw).startsWith(DISTILLER_MARKER);
}

/** Flatten the transcript JSONL into plain text, keeping the most recent tail. */
function flatten(raw) {
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
function distil(transcript, context, prior = '') {
  const earlier = prior.trim() ? `\n\n${PRIOR_NOTE_HEADER}\n${prior.trim()}` : '';
  const payload = `${PROMPT}\n\n=== GIT CONTEXT ===\n${context}${earlier}\n\n=== TRANSCRIPT ===\n${transcript}`;

  // Run outside the repo so the child files its own transcript where nothing here scans,
  // and loads none of this repo's hooks. A directory we cannot create is not a reason to
  // skip the note: fall back to the inherited cwd, where both guards still hold.
  let home;
  try {
    mkdirSync(DISTILLER_HOME, { recursive: true });
    home = DISTILLER_HOME;
  } catch {
    home = undefined;
  }

  const result = spawnSync('claude', ['-p', '--model', MODEL], {
    input: payload,
    cwd: home,
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

/** One flat `key: value` from the front matter, or `''`. Notes here are written, not hand-authored. */
export function frontMatterValue(text, key) {
  if (!text.startsWith('---')) return '';
  const block = text.slice(3).split('\n---')[0] ?? '';
  for (const line of block.split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at !== -1 && line.slice(0, at).trim() === key) return line.slice(at + 1).trim();
  }
  return '';
}

/** The note with its front matter and heading removed, normalised for comparison. */
export function noteBody(text) {
  const rest = text.startsWith('---')
    ? (text.slice(3).split('\n---').slice(1).join('\n---') ?? '')
    : text;
  return rest.replace(/^\s*#[^\n]*\n/, '').trim();
}

/**
 * Every note already in the directory, as `{ path, session, date, body }`. Read once and
 * reused by both dedupe checks, so the write path costs one scan rather than two.
 */
export function readNotes(directory) {
  let names;
  try {
    names = readdirSync(directory);
  } catch {
    return [];
  }
  const notes = [];
  for (const name of names) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const path = join(directory, name);
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    notes.push({
      path,
      session: frontMatterValue(text, 'session'),
      date: frontMatterValue(text, 'date'),
      body: noteBody(text),
    });
  }
  return notes;
}

/**
 * The body of the note this session already has, or `''` when it has none.
 *
 * It goes back to the distiller, so a rewrite adds to the earlier note instead of
 * replacing it. Front matter is stripped: the distiller is asked for a body, and handing
 * back the `summary:` line it wrote invites it to reproduce that line inside the note.
 */
export function priorBody(notes, sessionId) {
  if (!sessionId) return '';
  return notes.find((note) => note.session === sessionId)?.body ?? '';
}

/**
 * Where this note belongs and whether it is worth writing.
 *
 * Returns `{ target, date, skip }`. `skip` names the reason when an existing note already
 * carries this content — the caller logs it and writes nothing.
 */
export function placeNote(notes, body, sessionId, fallbackPath) {
  const mine = sessionId ? notes.find((note) => note.session === sessionId) : undefined;
  if (mine) {
    // The same session ending twice — resumed, or ended once per window. One note.
    if (mine.body === body) {
      return { target: mine.path, date: mine.date, skip: `unchanged: ${basename(mine.path)}` };
    }
    return { target: mine.path, date: mine.date, skip: null };
  }
  const twin = notes.find((note) => note.body === body);
  if (twin)
    return { target: twin.path, date: twin.date, skip: `duplicate of ${basename(twin.path)}` };
  return { target: fallbackPath, date: '', skip: null };
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

  // Guard one: the environment variable we set on the child. Logged rather than silent,
  // because a missing line beside a distillation run is how a leaking guard shows itself.
  if (process.env.CLAUDE_LEARNINGS_SKIP === '1') {
    logOutcome(directory, project, 'skipped: distiller session (env guard)');
    return 0;
  }

  const raw = readRaw(payload.transcript_path ?? '');

  // Guard two: the marker in the transcript itself. This one survives an environment that
  // did not propagate, which is the failure that filled the vault with near-copies.
  if (isDistillerTranscript(raw)) {
    logOutcome(directory, project, 'skipped: distiller session (transcript marker)');
    return 0;
  }

  const transcript = flatten(raw);
  if (transcript.length < 500) {
    logOutcome(directory, project, 'skipped: transcript under 500 chars');
    return 0;
  }

  // Read the vault before the distiller runs, not after: a rewrite has to send the earlier
  // note back, and the earlier note only exists in the vault.
  const notes = readNotes(directory);
  const sessionId = String(payload.session_id ?? '');

  const { text: distilled, failure } = distil(
    transcript,
    gitContext(cwd),
    priorBody(notes, sessionId),
  );
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
  const body = text.trim();
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const { target, date, skip } = placeNote(
    notes,
    body,
    sessionId,
    notePath(directory, project, sessionId),
  );
  if (skip) {
    logOutcome(directory, project, `skipped: ${skip}`);
    return 0;
  }

  // A rewrite keeps the note's original date, so it holds its place in the vault, and
  // records the later end in `updated:` instead.
  const first = date || stamp;
  const front =
    '---\n' +
    `date: ${first}\n` +
    (date && date !== stamp ? `updated: ${stamp}\n` : '') +
    `project: ${project}\n` +
    `session: ${sessionId}\n` +
    `summary: ${summary}\n` +
    'tags: [project-learnings, session-retro]\n' +
    '---\n\n' +
    `# ${project} — session learnings (${first})\n\n`;

  try {
    writeFileSync(target, `${front}${body}\n`, 'utf8');
  } catch (error) {
    process.stderr.write(`session_learnings: could not write ${target} (${error.message})\n`);
    logOutcome(directory, project, `failed: could not write note (${error.message})`);
    return 0;
  }

  // No index rebuild here by design — python-harness owns both indexes. See the note at
  // the top of this file.
  const verb = date ? 'rewrote' : 'wrote';
  process.stderr.write(`session_learnings: ${verb} ${target}\n`);
  logOutcome(directory, project, `${verb} ${basename(target)}`);
  return 0;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
