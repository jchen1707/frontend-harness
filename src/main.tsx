import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { logger } from '@/core/logger';
import { env } from '@/env';
import '@/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// Start the browser mock worker before the first query when VITE_MOCK_API is on.
// The dynamic import keeps the worker code out of the production entry chunk.
if (env.VITE_MOCK_API) {
  try {
    const { startMockWorker } = await import('@/test/msw/browser');
    await startMockWorker();
  } catch (error) {
    logger.error('Failed to start the browser mock worker', { error });
  }
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
