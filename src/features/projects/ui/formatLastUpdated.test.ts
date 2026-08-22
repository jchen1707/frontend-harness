import { describe, expect, it } from 'vitest';

import { formatLastUpdated } from './formatLastUpdated';

describe('formatLastUpdated', () => {
  const now = new Date('2026-08-08T12:00:00.000Z');

  it('returns "in the future" for a future timestamp', () => {
    const iso = new Date(now.getTime() + 60 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('in the future');
  });

  it('returns "just now" for timestamps under a minute old', () => {
    const iso = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('just now');
  });

  it('formats minutes ago', () => {
    const iso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('5 minutes ago');
  });

  it('formats one minute ago with singular wording', () => {
    const iso = new Date(now.getTime() - 1 * 60 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('1 minute ago');
  });

  it('formats hours ago', () => {
    const iso = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('3 hours ago');
  });

  it('formats days ago', () => {
    const iso = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('2 days ago');
  });

  it('formats weeks ago', () => {
    const iso = new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('2 weeks ago');
  });

  it('returns a long fallback for timestamps over four weeks old', () => {
    const iso = new Date(now.getTime() - 6 * 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastUpdated(iso, now)).toBe('more than 4 weeks ago');
  });
});
