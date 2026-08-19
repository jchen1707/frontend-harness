# Performance checklist — frontend-harness

The stack half of the shared `perf-reviewer` frame. The frame carries the rule that every
finding names the scale at which it starts to hurt — here that is rows, renders, kilobytes,
and on what connection.

- **Waterfalls.** A request that cannot start until an earlier one resolves, because the
  component issuing it renders only after the first resolves. This is the single largest
  avoidable latency in a React app. Look for nested `useQuery` chains and data fetched inside
  a lazily-rendered child.
- **Bundle growth.** A new dependency pulled into the initial chunk. A route that is not code
  split. A library imported wholesale (`import _ from 'lodash'`) for one function. An icon
  set, a date library with all locales, a chart library on a page that does not chart. Name
  the approximate weight and whether it lands in the initial download.
- **Render amplification.** A context whose value is a new object each render, so every
  consumer re-renders on every parent render. A list re-created rather than keyed stably. An
  expensive computation in a component body with no memo — and, equally, memoisation costing
  more than it saves.
- **Unbounded lists.** Every row of a response rendered with no pagination and no
  virtualisation. Name the row count at which it becomes visible.
- **Layout thrash and CLS.** Reading layout (`offsetWidth`, `getBoundingClientRect`) then
  writing style in the same frame; images and embeds with no reserved space; fonts swapping
  late.
- **Query configuration.** Cache times forcing a refetch on every mount, over-broad query keys
  invalidating everything, refetch-on-focus left on for expensive queries.
- **Effects doing network or DOM work every render** because their dependency array is wrong.

## Measuring, and the budget that does not

Where `lighthouserc.json` sets a budget, check the change against it rather than against your
intuition — **and know its limits.** Only the accessibility assertion is `error`; the
performance category currently scores `null`, because the pinned Lighthouse cannot trace
against the installed Chrome. A budget that measured nothing is not evidence, and a `pnpm lhci`
that exits 0 has not told you it passed.

Where a claim needs a number, a real trace beats an argument. The `chrome-devtools` MCP server
records one — `performance_start_trace` with `reload`, then `performance_analyze_insight` for
the specific insight (`LCPBreakdown`, `DocumentLatency`). Measure, then report; your tools for
the code stay read-only.
