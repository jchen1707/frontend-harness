const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

function pluralize(count: number, singular: string, plural: string): string {
  const label = count === 1 ? singular : plural;
  return `${String(count)} ${label}`;
}

// Short relative time with the ISO value in the title attribute.
// `now` is injectable so tests stay deterministic.
export function formatLastUpdated(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) {
    return 'in the future';
  }

  if (diffMs < MINUTE_MS) {
    return 'just now';
  }

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `${pluralize(minutes, 'minute', 'minutes')} ago`;
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `${pluralize(hours, 'hour', 'hours')} ago`;
  }

  if (diffMs < WEEK_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    return `${pluralize(days, 'day', 'days')} ago`;
  }

  const weeks = Math.floor(diffMs / WEEK_MS);
  if (weeks <= 4) {
    return `${pluralize(weeks, 'week', 'weeks')} ago`;
  }

  return 'more than 4 weeks ago';
}
