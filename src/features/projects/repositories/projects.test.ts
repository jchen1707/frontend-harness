import { delay, HttpResponse, http } from 'msw';
import { ZodError } from 'zod';

import { HttpError, ValidationError } from '@/core/errors';
import { logger } from '@/core/logger';
import { env } from '@/env';
import { defaultProjects } from '@/test/fixtures/projects';
import { server } from '@/test/msw/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FakeProjectsRepository, HttpProjectsRepository } from './projects';

vi.mock('@/core/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const API_URL = `${env.VITE_API_BASE_URL}/projects`;

afterEach(() => {
  vi.clearAllMocks();
});

describe('HttpProjectsRepository', () => {
  it('parses a valid envelope and returns the unwrapped Project array', async () => {
    const repository = new HttpProjectsRepository();

    const projects = await repository.listProjects();

    expect(projects).toEqual(defaultProjects);
  });

  it('raises ValidationError, not ZodError, on a malformed response', async () => {
    server.use(
      http.get(API_URL, () =>
        HttpResponse.json({
          projects: [
            {
              id: 'bad-1',
              name: 'Bad project',
              status: 'deleted',
            },
          ],
        }),
      ),
    );
    const repository = new HttpProjectsRepository();

    let caughtError: unknown;
    try {
      await repository.listProjects();
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ValidationError);
    expect((caughtError as Error).cause).toBeInstanceOf(ZodError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('raises HttpError on a 500 response', async () => {
    server.use(http.get(API_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const repository = new HttpProjectsRepository();

    await expect(repository.listProjects()).rejects.toBeInstanceOf(HttpError);
    await expect(repository.listProjects()).rejects.toMatchObject({ status: 500 });
  });

  it('rethrows an AbortError without logging', async () => {
    server.use(
      http.get(API_URL, async () => {
        await delay(200);
        return HttpResponse.json({ projects: defaultProjects });
      }),
    );
    const controller = new AbortController();
    const repository = new HttpProjectsRepository();
    const promise = repository.listProjects(controller.signal);
    controller.abort();

    await expect(promise).rejects.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('FakeProjectsRepository', () => {
  it('resolves the constructor array with no network', async () => {
    const repository = new FakeProjectsRepository(defaultProjects);

    const projects = await repository.listProjects();

    expect(projects).toEqual(defaultProjects);
  });
});
