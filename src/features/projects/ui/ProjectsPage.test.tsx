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

function makeWrapper(initialEntry = '/projects'): (props: { children: ReactNode }) => JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
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

  it('filters Projects by name without requesting them again', async () => {
    const listProjects = vi.fn().mockResolvedValue(defaultProjects);
    render(<ProjectsPage repository={{ listProjects }} />, { wrapper: makeWrapper() });

    const searchBox = await screen.findByRole('searchbox', { name: 'Search projects' });
    await userEvent.type(searchBox, '2');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Project 2' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Project 1' })).not.toBeInTheDocument();
    });
    expect(listProjects).toHaveBeenCalledTimes(1);
  });

  it('restores a URL search and offers a control that clears a no-match result', async () => {
    const repository = { listProjects: () => Promise.resolve(defaultProjects) };
    render(<ProjectsPage repository={repository} />, {
      wrapper: makeWrapper('/projects?q=missing'),
    });

    expect(screen.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('missing');
    expect(await screen.findByText('No projects match your search.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Project 1' })).toBeInTheDocument();
    });
  });

  it('announces only the settled result count in a hidden status region', async () => {
    const repository = { listProjects: () => Promise.resolve(defaultProjects) };
    render(<ProjectsPage repository={repository} />, { wrapper: makeWrapper() });

    const status = screen.getByRole('status');
    await waitFor(() => {
      expect(status).toHaveTextContent('2 projects found.');
    });
    expect(screen.getByRole('table')).not.toContainElement(status);

    const announcements: string[] = [];
    const observer = new MutationObserver(() => {
      announcements.push(status.textContent);
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search projects' }), '2x');
    await waitFor(() => {
      expect(status).toHaveTextContent('0 projects found.');
    });
    observer.disconnect();

    expect(announcements).toEqual(['0 projects found.']);
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
