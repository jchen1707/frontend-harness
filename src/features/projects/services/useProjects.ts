// Service layer (feature-internal): business logic + data hooks composing
// the feature's own repositories. UI → services → repositories → core.
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ValidationError } from '@/core/errors';

import { HttpProjectsRepository, type ProjectsRepository } from '../repositories/projects';
import { type Project } from '../repositories/schemas/project';

export type { Project } from '../repositories/schemas/project';

const defaultRepository = new HttpProjectsRepository();

export type ProjectsErrorKind = 'transport' | 'schema';

export interface UseProjectsOptions {
  repository?: ProjectsRepository | undefined;
}

export interface UseProjectsResult {
  projects: Project[];
  isPending: boolean;
  isRefetching: boolean;
  errorKind: ProjectsErrorKind | null;
  refetch: () => Promise<unknown>;
}

function toErrorKind(error: Error): ProjectsErrorKind {
  if (error instanceof ValidationError) {
    return 'schema';
  }

  return 'transport';
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsResult {
  const { repository = defaultRepository } = options;

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: ({ signal }) => repository.listProjects(signal),
    select: (allProjects) =>
      allProjects
        .filter((project) => project.status !== 'archived')
        .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt)),
  });

  // TanStack Query clears `error` while a refetch is in flight. Remember the last
  // error so the error state (and its busy retry button) stays on screen until
  // the refetch either succeeds or fails with a new error.
  const lastErrorKind = useRef<ProjectsErrorKind | null>(null);
  useEffect(() => {
    if (error) {
      lastErrorKind.current = toErrorKind(error);
    }
  }, [error]);
  useEffect(() => {
    if (data !== undefined) {
      lastErrorKind.current = null;
    }
  }, [data]);

  const currentErrorKind = error ? toErrorKind(error) : null;
  const retryingAfterError = isFetching && lastErrorKind.current !== null;
  const errorKind = currentErrorKind ?? (retryingAfterError ? lastErrorKind.current : null);
  const isRefetching = (isFetching && !isPending) || retryingAfterError;

  return {
    projects: data ?? [],
    isPending,
    isRefetching,
    errorKind,
    refetch,
  };
}
