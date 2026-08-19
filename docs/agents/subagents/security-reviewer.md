# Security checklist — frontend-harness

The stack half of the shared `security-reviewer` frame. The frame carries the method — trace
the data, give the attack path, confirm reachability — and the reporting rules. This is what
to prioritise here.

**The browser is a public place.** That is the failure mode that matters most in this repo and
the one generic advice misses.

- **Secrets in the bundle.** Every `VITE_`-prefixed variable is compiled into the JavaScript
  the browser downloads. An API key, a token, a signing secret or a private endpoint behind a
  `VITE_` name is disclosed, not configured. `ANTHROPIC_API_KEY` and `GH_TOKEN` are
  server-side only — an Anthropic call made from the browser ships the key to every visitor.
- **XSS.** `dangerouslySetInnerHTML`, `innerHTML`, injecting into `<script>` or `<style>`, a
  `javascript:` URL reaching `href` or `src`, and any user-controlled value rendered without
  escaping. React escapes text nodes; it escapes nothing in those places.
- **Unvalidated input crossing a boundary.** A response consumed with `as` instead of a Zod
  `parse` is untrusted data typed as trusted. Same for URL params, `postMessage` payloads,
  `localStorage`, and anything read back from a query string.
- **Auth and tokens.** A token in `localStorage` is readable by any script on the page. Check
  where credentials live, whether `credentials: 'include'` is set on requests that need it and
  absent on those that do not, and whether an authorization decision is being made in the
  client that only the server can enforce.
- **Outbound surface.** A new host in a `fetch`, an `<img>`, a `<script>` or a CSP-relevant
  tag. Missing timeouts and missing error handling on network calls. Redirects built from
  user-controlled input.
- **Dependency and supply chain.** A new package added in this diff: is it the package it
  claims to be, is it pulled at a floating version, does it run install scripts?
