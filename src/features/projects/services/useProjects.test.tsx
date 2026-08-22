import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { HttpError, ValidationError } from '@/core/errors';

import { FakeProjectsRepository, type ProjectsRepository } from '../repositories/projects';
import { type Project } from '../repositories/schemas/project';
import { useProjects } from './useProjects';

function makeWrapper(): (props: { children: ReactNode }) => JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeProject(overrides: Partial<Project> & Pick<Project, 'id'>): Project {
  return {
    name: `Project ${overrides.id}`,
    status: 'active',
    lastUpdatedAt: '2026-08-01T12:00:00.000Z',
    owner: { id: `owner-${overrides.id}`, name: `Owner ${overrides.id}` },
    ...overrides,
  };
}

describe('useProjects', () => {
  it('excludes archived Projects and sorts the rest newest first', async () => {
    const repository = new FakeProjectsRepository([
      makeProject({ id: 'paused-1', status: 'paused', lastUpdatedAt: '2026-08-01T10:00:00.000Z' }),
      makeProject({ id: 'active-1', status: 'active', lastUpdatedAt: '2026-08-01T12:00:00.000Z' }),
      makeProject({
        id: 'archived-1',
        status: 'archived',
        lastUpdatedAt: '2026-08-01T11:00:00.000Z',
      }),
    ]);
    const { result } = renderHook(() => useProjects({ repository }), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(!result.current.isPending).toBe(true);
    });

    expect(result.current.projects.map((project) => project.id)).toEqual(['active-1', 'paused-1']);
  });

  it('maps a ValidationError to errorKind schema', async () => {
    const repository: ProjectsRepository = {
      listProjects: () => Promise.reject(new ValidationError('bad response')),
    };
    const { result } = renderHook(() => useProjects({ repository }), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.errorKind).toBe('schema');
    });
  });

  it('maps an HttpError to errorKind transport', async () => {
    const repository: ProjectsRepository = {
      listProjects: () => Promise.reject(new HttpError('Request failed: GET /projects', 500)),
    };
    const { result } = renderHook(() => useProjects({ repository }), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.errorKind).toBe('transport');
    });
  });

  it('exposes an empty account as an empty array, not an error', async () => {
    const repository = new FakeProjectsRepository([]);
    const { result } = renderHook(() => useProjects({ repository }), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(!result.current.isPending).toBe(true);
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.errorKind).toBeNull();
  });
});
