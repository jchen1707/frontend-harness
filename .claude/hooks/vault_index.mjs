#!/usr/bin/env node
/**
 * Build an agent-readable index of the whole vault, not only the learnings folder.
 *
 * An Obsidian `.base` file is a **query**, evaluated by Obsidian's own UI. An agent that
 * reads `LLM.base` gets the query definition back, never its results — so a Base makes the
 * vault browsable for a human and does nothing at all for retrieval by Claude. The
 * agent-readable half has to be generated Markdown. `session_learnings.mjs` already writes
 * one for the learnings folder; this writes one for every note in the vault.
 *
 * **Rows are derived, not required.** Most hand-written notes carry no front matter, and an
 * index that only listed notes with a `summary:` field would start out covering a fraction
 * of the vault and silently stay there. Front matter is used when present and inferred when
 * not: the description falls back to the first line of real prose.
 *
 * Configure with `CLAUDE_VAULT_DIR`. Unset falls back to the parent of
 * `CLAUDE_LEARNINGS_DIR`, so the usual layout — a learnings folder sitting inside a vault —
 * needs no new configuration. Both unset means there is no vault, and this does nothing.
 *
 * Refresh by hand with `node .claude/hooks/vault_index.mjs`.
 *
 * **This file has a twin.** `python-harness/.claude/hooks/vault_index.py` is the same
 * generator, and both write the same `_VAULT_INDEX.md` in the same vault. Whichever
 * harness ends a session last wins, so the two must produce **byte-identical** output —
 * that is why the header below names no harness-specific refresh command. A change to
 * the description heuristic here needs the same change there, or the index quietly means
 * something different depending on which repo you worked in last.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const INDEX_NAME = '_VAULT_INDEX.md';

/**
 * Folders holding no indexable prose. `.obsidian` is editor config; an Excalidraw note is
 * a base64 drawing payload wearing a `.md` extension, so its "first line of prose" is
 * kilobytes of encoded binary.
 */
const SKIP_DIRS = new Set(['.obsidian', '.trash', '.git', 'Excalidraw', 'Attachments']);

/**
 * Generated indexes, this one included. Indexing an index yields a row that says nothing
 * and grows every time the thing it describes does.
 */
const SKIP_NAMES = new Set([INDEX_NAME, '_INDEX.md']);

const MAX_DESC = 160;

/**
 * Shortest line worth treating as a description. Below this it is a fragment — a stray
 * word, a table cell — and the next line is a better answer.
 */
const MIN_DESC = 25;

/**
 * Lines that carry no information about what a note covers: headings, bullets, table rows
 * and rules, fences, images, and front-matter delimiters.
 */
const NOISE = /^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|\||```|!\[|-{3,}\s*$|={3,}\s*$)/;

/**
 * A short line built around a wikilink points at another note rather than describing this
 * one. Whole folders open with a shared pointer — "Refer to [[Template]] for guidelines" —
 * which would hand a dozen unrelated notes the same description and make the index useless
 * for choosing between them. Long lines are exempt: those carry their own content after
 * the reference.
 */
const CROSS_REFERENCE = /\[\[/;
const CROSS_REFERENCE_MAX = 100;

/**
 * Strip blockquote and Obsidian callout markers, keeping the text inside.
 *
 * Separate from `stripMarkdown` because the noise test has to run on the *unwrapped*
 * line: a bullet nested in a callout (`>> - **Now:** ...`) is still a bullet, and testing
 * the raw line lets it through as though it were prose.
 */
export function unquote(line) {
  return line.replace(/^\s*>+\s*/, '').replace(/^\[![a-z]+\][-+]?\s*/i, '');
}

/** Reduce one line of Markdown to the text a human would read aloud. */
export function stripMarkdown(line) {
  return unquote(line)
    .replace(/!?\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .trim();
}

/**
 * Parse the flat `key: value` front matter these notes use.
 *
 * Deliberately not a YAML parser: these hooks have no dependencies. Block sequences
 * (`tags:` then an indented `- hashmap`) fold into a comma-joined string, because inline
 * `[a, b]` and block form are the only two shapes the vault contains and callers want one
 * of them.
 */
export function frontMatter(text) {
  if (!text.startsWith('---')) return {};
  const after = text.slice(text.indexOf('---\n') + 4);
  const end = after.indexOf('\n---');
  if (end === -1) return {}; // Unterminated front matter is body text starting with a rule.

  const fields = {};
  let key = '';
  for (const line of after.slice(0, end).split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && key) {
      fields[key] = `${fields[key]}, ${item[1].trim()}`.replace(/^,\s*/, '');
      continue;
    }
    const colon = line.indexOf(':');
    if (colon !== -1) {
      key = line.slice(0, colon).trim();
      fields[key] = line
        .slice(colon + 1)
        .trim()
        .replace(/^\[|\]$/g, '');
    }
  }
  return fields;
}

/** The note with its front matter removed. */
export function body(text) {
  if (!text.startsWith('---')) return text;
  const after = text.slice(text.indexOf('---\n') + 4);
  const end = after.indexOf('\n---');
  return end === -1 ? text : after.slice(end + 4);
}

/** Collapse whitespace and cut to MAX_DESC on a word boundary. */
export function truncate(text) {
  const collapsed = text.split(/\s+/).filter(Boolean).join(' ');
  if (collapsed.length <= MAX_DESC) return collapsed;
  return `${collapsed.slice(0, MAX_DESC).replace(/\s\S*$/, '')}…`;
}

/**
 * One line saying what a note covers.
 *
 * A `summary:` field wins: the SessionEnd hook writes one, and anything hand-written
 * beats anything inferred. Otherwise take the first line of real prose.
 */
export function describe(text) {
  const summary = frontMatter(text).summary;
  if (summary) return truncate(summary);

  let pointer = '';
  for (const quoted of body(text).split(/\r?\n/)) {
    const raw = unquote(quoted);
    if (NOISE.test(raw)) continue;
    const line = stripMarkdown(raw);
    if (line.length < MIN_DESC) continue;
    if (CROSS_REFERENCE.test(raw) && line.length < CROSS_REFERENCE_MAX) {
      pointer ||= line; // Keep looking, but do not come back empty-handed.
      continue;
    }
    return truncate(line);
  }
  return truncate(pointer);
}

/** Every indexable note in the vault, ordered by path. */
export function notes(vault) {
  let entries;
  try {
    entries = readdirSync(vault, { recursive: true, encoding: 'utf8' });
  } catch {
    return [];
  }
  return entries
    .map((entry) => entry.split(sep).join('/'))
    .filter((relative) => relative.toLowerCase().endsWith('.md'))
    .filter((relative) => {
      const parts = relative.split('/');
      if (SKIP_NAMES.has(parts.at(-1))) return false;
      return !parts.slice(0, -1).some((part) => SKIP_DIRS.has(part));
    })
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/** Render the whole index. Pure: reads notes, returns Markdown, writes nothing. */
export function build(vault) {
  const rows = [];
  for (const relative of notes(vault)) {
    let text;
    try {
      text = readFileSync(join(vault, relative), 'utf8');
    } catch {
      continue; // A note we cannot read is one row missing, not a failed index.
    }
    rows.push([relative, frontMatter(text).tags ?? '', describe(text)]);
  }

  const lines = [
    '---',
    'tags: [vault-index]',
    '---',
    '',
    '# Vault index',
    '',
    'Generated. Do not edit: it is rebuilt every time a Claude Code session ends in a',
    'repo with the second brain configured. Refresh by hand by running the `vault_index`',
    'hook in that repo, under `.claude/hooks/`.',
    '',
    'One row per note. Read this first, then open only the notes whose row matches.',
    'Reading every note to answer one question is the cost this file exists to avoid.',
    '',
    'Paths are relative to the vault root, so a row is directly readable. The',
    'session notes under `Project Learnings/` carry a second, richer index in',
    '`Project Learnings/_INDEX.md`, which adds their date and originating project.',
    '',
    `${rows.length} notes.`,
    '',
    '| Note | Tags | What it covers |',
    '| --- | --- | --- |',
  ];
  for (const [path, tags, description] of rows) {
    const cells = [`\`${path}\``, tags, description];
    lines.push(`| ${cells.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** The vault root, or `null` when none is configured or the path is not a directory. */
export function vaultDir() {
  let raw = (process.env.CLAUDE_VAULT_DIR ?? '').trim();
  if (!raw) {
    const learnings = (process.env.CLAUDE_LEARNINGS_DIR ?? '').trim();
    if (!learnings) return null;
    raw = resolve(learnings, '..');
  }
  try {
    return statSync(raw).isDirectory() ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Rebuild the index. Returns the file written, or `null` if there was nothing to do.
 *
 * Never throws. This runs from a SessionEnd hook, and a vault that cannot be indexed is
 * not a reason to interfere with ending a session.
 */
export function refresh() {
  const vault = vaultDir();
  if (vault === null) return null;
  const target = join(vault, INDEX_NAME);
  try {
    writeFileSync(target, build(vault), 'utf8');
  } catch (error) {
    process.stderr.write(`vault_index: could not write ${target} (${error.message})\n`);
    return null;
  }
  return target;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === resolve(fileURLToPath(import.meta.url))) {
  const written = refresh();
  process.stderr.write(
    written === null
      ? 'vault_index: no vault configured - set CLAUDE_VAULT_DIR or CLAUDE_LEARNINGS_DIR\n'
      : `vault_index: wrote ${written}\n`,
  );
  process.exit(0);
}
