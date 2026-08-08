import type { JSX } from 'react';

import { type ProjectsErrorKind } from '../services/useProjects';

interface ProjectsErrorStateProps {
  errorKind: ProjectsErrorKind;
  onRetry: () => void;
  isRefetching: boolean;
}

const COPY: Record<ProjectsErrorStateProps['errorKind'], string> = {
  transport: 'We could not load your projects.',
  schema: 'Projects data could not be read.',
};

export function ProjectsErrorState({
  errorKind,
  onRetry,
  isRefetching,
}: ProjectsErrorStateProps): JSX.Element {
  return (
    <div role="alert" className="text-slate-800">
      <p>{COPY[errorKind]}</p>
      <button
        type="button"
        onClick={onRetry}
        aria-busy={isRefetching}
        disabled={isRefetching}
        className="mt-4 rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
      >
        Retry
      </button>
    </div>
  );
}
