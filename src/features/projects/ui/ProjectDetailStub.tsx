import type { JSX } from 'react';
import { useParams } from 'react-router-dom';

// Placeholder route for /projects/:id. It reads the id so the link target is visibly correct.
export function ProjectDetailStub(): JSX.Element {
  const { id } = useParams();
  const projectId = id ?? '';

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Project {projectId}</h1>
      <p className="mt-2 text-slate-600">Project detail placeholder for {projectId}.</p>
    </main>
  );
}
