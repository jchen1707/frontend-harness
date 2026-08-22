import type { JSX } from 'react';

import { useProjects, type UseProjectsOptions } from '../services/useProjects';
import { ProjectsEmptyState } from './ProjectsEmptyState';
import { ProjectsErrorState } from './ProjectsErrorState';
import { ProjectsTable } from './ProjectsTable';
import { ProjectsTableSkeleton } from './ProjectsTableSkeleton';

// Route component = controller/transport layer: calls a service, shapes the view.
export function ProjectsPage({ repository }: UseProjectsOptions = {}): JSX.Element {
  const { projects, isPending, isRefetching, errorKind, refetch } = useProjects({ repository });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Projects</h1>
      <div className="sr-only" role="status" aria-live="polite">
        {isPending && !errorKind ? 'Loading projects' : null}
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
        {!errorKind && projects.length === 0 && <ProjectsEmptyState />}
        {!errorKind && projects.length > 0 && <ProjectsTable projects={projects} />}
      </section>
    </main>
  );
}
