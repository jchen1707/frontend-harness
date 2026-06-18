import type { JSX } from 'react';

import { useHealth } from '@/services/health';

// Route component = controller/transport layer: calls a service, shapes the view.
export function Home(): JSX.Element {
  const { data, isError, isPending, fetchStatus } = useHealth();
  // A disabled query stays `pending` with an `idle` fetchStatus (no request made).
  const disabled = isPending && fetchStatus === 'idle';

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">frontend-development-harness</h1>
      <p className="mt-2 text-slate-600">A harness, not an application.</p>
      <section className="mt-6" aria-live="polite">
        {disabled && (
          <p>Health check disabled — set VITE_HEALTHCHECK_ENABLED=true to probe the backend.</p>
        )}
        {!disabled && isPending && <p>Checking health…</p>}
        {isError && <p role="alert">Health check unavailable (no backend wired yet).</p>}
        {data && (
          <p>
            Status: {data.status} (v{data.version})
          </p>
        )}
      </section>
    </main>
  );
}
