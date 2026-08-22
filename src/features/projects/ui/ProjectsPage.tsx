import { useEffect, useRef, useState, type JSX } from 'react';
import { NavigationType, useNavigationType, useSearchParams } from 'react-router-dom';

import { useProjects, type UseProjectsOptions } from '../services/useProjects';
import { ProjectsEmptyState } from './ProjectsEmptyState';
import { ProjectsErrorState } from './ProjectsErrorState';
import { ProjectsTable } from './ProjectsTable';
import { ProjectsTableSkeleton } from './ProjectsTableSkeleton';

type ProjectsPageProps = Pick<UseProjectsOptions, 'repository'>;

// Route component = controller/transport layer: calls a service, shapes the view.
export function ProjectsPage({ repository }: ProjectsPageProps = {}): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const urlSearchText = searchParams.get('q') ?? '';
  const [searchText, setSearchText] = useState(urlSearchText);
  const hasSearchHistoryEntry = useRef(urlSearchText.length > 0);
  const { projects, isPending, isRefetching, isSearchPending, errorKind, refetch } = useProjects({
    repository,
    searchText,
  });
  const [resultAnnouncement, setResultAnnouncement] = useState('');

  useEffect(() => {
    if (navigationType === NavigationType.Pop) {
      setSearchText(urlSearchText);
      hasSearchHistoryEntry.current = urlSearchText.length > 0;
    }
  }, [navigationType, urlSearchText]);

  useEffect(() => {
    if (isPending || errorKind || isSearchPending) {
      return;
    }

    const announcementTimer = window.setTimeout(() => {
      const projectWord = projects.length === 1 ? 'project' : 'projects';
      setResultAnnouncement(`${String(projects.length)} ${projectWord} found.`);
    }, 500);

    return () => {
      window.clearTimeout(announcementTimer);
    };
  }, [errorKind, isPending, isSearchPending, projects.length, searchText]);

  function updateSearchText(value: string): void {
    setSearchText(value);
    const replace = hasSearchHistoryEntry.current;
    hasSearchHistoryEntry.current = value.length > 0;
    setSearchParams(
      (currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);
        if (value) {
          nextSearchParams.set('q', value);
        } else {
          nextSearchParams.delete('q');
        }
        return nextSearchParams;
      },
      { replace },
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Projects</h1>
      <div className="mt-6 max-w-md">
        <label htmlFor="project-search" className="block font-semibold">
          Search projects
        </label>
        <input
          id="project-search"
          type="search"
          value={searchText}
          onChange={(event) => {
            updateSearchText(event.target.value);
          }}
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {isPending && !errorKind ? 'Loading projects' : resultAnnouncement}
      </div>
      <section className="mt-6">
        {isPending && !errorKind && <ProjectsTableSkeleton />}
        {errorKind && (
          <ProjectsErrorState
            errorKind={errorKind}
            onRetry={() => {
              void refetch();
            }}
            isRefetching={isRefetching}
          />
        )}
        {!errorKind && projects.length === 0 && !searchText && <ProjectsEmptyState />}
        {!errorKind && projects.length === 0 && searchText && (
          <div>
            <p className="text-slate-600">No projects match your search.</p>
            <button
              type="button"
              onClick={() => {
                updateSearchText('');
              }}
              className="mt-3 rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
            >
              Clear search
            </button>
          </div>
        )}
        {!errorKind && projects.length > 0 && <ProjectsTable projects={projects} />}
      </section>
    </main>
  );
}
