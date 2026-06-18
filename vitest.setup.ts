import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from '@/test/msw/server';

// Offline-by-default unit tests: all network goes through MSW.
// Any unmocked request throws, so tests never hit the real network.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
