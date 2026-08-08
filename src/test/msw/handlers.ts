import { HttpResponse, http } from 'msw';

import { env } from '@/env';
import { projectListSchema } from '@/features/projects/repositories/schemas/project';
import { defaultProjects } from '@/test/fixtures/projects';

// Default request handlers for offline unit tests. Add per-test overrides with
// server.use(...) inside individual specs.
export const handlers = [
  http.get(`${env.VITE_API_BASE_URL}/healthz`, () =>
    HttpResponse.json({ status: 'ok', version: 'test' }),
  ),
  http.get(`${env.VITE_API_BASE_URL}/projects`, () =>
    HttpResponse.json(projectListSchema.parse({ projects: defaultProjects })),
  ),
];
