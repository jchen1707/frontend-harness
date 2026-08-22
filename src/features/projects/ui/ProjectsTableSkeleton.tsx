import type { JSX } from 'react';

// Skeleton loading state that preserves the table column layout.
// aria-hidden keeps the shimmer out of assistive-technology navigation.
export function ProjectsTableSkeleton(): JSX.Element {
  return (
    <div aria-hidden className="animate-pulse" data-testid="projects-table-skeleton">
      <div className="mb-2 h-4 w-32 rounded bg-slate-200" />
      <div className="grid grid-cols-4 gap-4 border-b border-slate-200 py-2">
        <div className="h-4 rounded bg-slate-200" />
        <div className="h-4 rounded bg-slate-200" />
        <div className="h-4 rounded bg-slate-200" />
        <div className="h-4 rounded bg-slate-200" />
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid grid-cols-4 gap-4 border-b border-slate-100 py-3">
          <div className="h-4 rounded bg-slate-200" />
          <div className="h-4 rounded bg-slate-200" />
          <div className="h-4 rounded bg-slate-200" />
          <div className="h-4 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
