import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { ValidationError } from '@/core/errors';
import { env } from '@/env';
import { server } from '@/test/msw/server';

import { HttpHealthRepository } from './health';

describe('HttpHealthRepository', () => {
  it('rejects an invalid health response with its validation cause', async () => {
    server.use(
      http.get(`${env.VITE_API_BASE_URL}/healthz`, () =>
        HttpResponse.json({ status: 'unknown', version: 1 }),
      ),
    );

    try {
      await new HttpHealthRepository().getHealth();
      expect.unreachable('Expected getHealth to reject');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ValidationError);
      if (!(error instanceof ValidationError)) {
        throw error;
      }
      expect(error.cause).toBeInstanceOf(ZodError);
    }
  });
});
