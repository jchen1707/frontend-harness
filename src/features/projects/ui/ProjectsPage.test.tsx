import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpError, ValidationError } from '@/core/errors';
import { env } from '@/env';
import { defaultProjects } from '@/test/fixtures/projects';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

import { type Project } from '../services/useProjects';
import { ProjectsPage } from './ProjectsPage';

function makeWrapper(): (props: { children: ReactNode }) => JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
      <MemoryRouter>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

afterEach(() => {
  cleanup();
});

describe('ProjectsPage', () => {
  it('shows the loading state', () => {
    let resolveLoading: ((projects: Project[]) => void) | undefined;
    const repository = {
      listProjects: () =>
        new Promise<Project[]>((resolve) => {
          resolveLoading = resolve;
        }),
    };
    render(<ProjectsPage repository={repository} />, { wrapper: makeWrapper() });

    expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
    const skeleton = screen.getByTestId('projects-table-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-hidden');
    resolveLoading?.([]);
  });

  it('shows the results state', async () => {
    const repository = { listProjects: () => Promise.resolve(defaultProjects) };
    render(<ProjectsPage repository={repository} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  it('shows the empty state', async () => {
    const repository = { listProjects: () => Promise.resolve([]) };
    render(<ProjectsPage repository={repository} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('You do not have any projects yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a transport error', async () => {
    const repository = {
      listProjects: () => Promise.reject(new HttpError('Request failed: GET /projects', 500)),
    };
    render(<ProjectsPage repository={repository} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('We could not load your projects.')).toBeInTheDocument();
    });
  });

  it('shows a schema error', async () => {
    const repository = {
      listProjects: () =>
        Promise.reject(new ValidationError('Projects response failed validation')),
    };
    render(<ProjectsPage repository={repository} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Projects data could not be read.')).toBeInTheDocument();
    });
  });

  it('does not leak the request path, error message or a stack trace', async () => {
    server.use(
      http.get(`${env.VITE_API_BASE_URL}/projects`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    const { container } = render(<ProjectsPage />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('We could not load your projects.')).toBeInTheDocument();
    });

    const text = container.textContent || '';
    expect(text).not.toContain('/projects');
    expect(text).not.toContain('Request failed');
    expect(text).not.toContain('at ');
  });

  it('retries the request and reports aria-busy while refetching', async () => {
    let resolveSecond: ((projects: Project[]) => void) | undefined;
    const listProjects = vi
      .fn()
      .mockRejectedValueOnce(new HttpError('Request failed: GET /projects', 500))
      .mockImplementationOnce(
        () =>
          new Promise<Project[]>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const repository = { listProjects };
    render(<ProjectsPage repository={repository} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(retryButton).toHaveAttribute('aria-busy', 'true');
    });

    resolveSecond?.(defaultProjects);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(listProjects).toHaveBeenCalledTimes(2);
  });
});
