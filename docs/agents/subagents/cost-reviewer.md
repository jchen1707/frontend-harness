# Cost checklist — frontend-harness

The stack half of the shared `cost-reviewer` frame. Two kinds of spend here: **tokens** on the
server side of any AI feature, and **bytes and requests** on the client side.

**`AGENTS.md` names the model default and when to downgrade.** Read it; this is the summary.

## Token spend

- **Static system prompts with no `cache_control` breakpoint.** A prompt resent unchanged on
  every call is the most common avoidable cost there is.
- **Cache breakpoints after varying content.** A breakpoint below anything that changes per
  request caches nothing — the prefix no longer matches.
- **The wrong model for the job**, on routine high-volume work. **Model ids inline** instead
  of read once from server-side config, so nobody can change the model without a deploy.
- **Unbounded agent loops** — no iteration cap, no token budget, no stop condition.
- **Sampling parameters passed alongside adaptive thinking** — `temperature`, `top_p`,
  `top_k`. `AGENTS.md` forbids them; passing them is both wrong and wasteful.
- **Sending more context than the task needs** — a whole file where a function would do, a
  full transcript where the tail would do.
- **Any Anthropic call reachable from browser code.** A security finding first — the key is in
  the bundle — and a cost finding second, because anyone can spend it. Report both.

## Network and byte spend

- **Over-fetching.** A GraphQL query selecting fields nothing renders. A REST call fetching a
  full collection to show a count.
- **Refetch churn.** Query configuration refetching on every mount or focus for data that
  changes hourly.
- **Duplicate requests** — the same query issued under two different keys, so the cache never
  hits.
- **Unbatched N+1 requests** — one request per rendered row.
- **Payloads that grow without bound** — no pagination, no limit, an endpoint returning
  everything and filtered in the client.

Work out the **call volume**: per session, per render, per row. One uncached prompt on an
admin page nobody visits is not worth an author's attention.
