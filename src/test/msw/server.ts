import { setupServer } from 'msw/node';

import { handlers } from '@/test/msw/handlers';

// Node MSW server used by Vitest (configured in vitest.setup.ts).
export const server = setupServer(...handlers);
