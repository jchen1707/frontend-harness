import { setupWorker } from 'msw/browser';

import { env } from '@/env';
import { handlers } from '@/test/msw/handlers';

// Browser MSW worker used in dev when VITE_MOCK_API is true.
// Dynamically imported from main.tsx so it stays out of the production entry chunk.
export function startMockWorker(): Promise<ServiceWorkerRegistration | undefined> {
  return setupWorker(...handlers).start({
    onUnhandledRequest(req: Request, print: { error: () => void }): void {
      if (new URL(req.url).href.startsWith(env.VITE_API_BASE_URL)) {
        print.error();
        return;
      }
    },
  });
}
