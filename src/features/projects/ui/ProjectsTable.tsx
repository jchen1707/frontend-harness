import type { JSX } from 'react';
import { Link } from 'react-router-dom';

import { type Project } from '../services/useProjects';
import { formatLastUpdated } from './formatLastUpdated';

interface ProjectsTableProps {
  projects: Project[];
}

export function ProjectsTable({ projects }: ProjectsTableProps): JSX.Element {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Projects</caption>
      <thead>
        <tr className="border-b border-slate-200">
          <th scope="col" className="py-2 pr-4 font-semibold">
            Name
          </th>
          <th scope="col" className="py-2 pr-4 font-semibold">
            Status
          </th>
          <th scope="col" className="py-2 pr-4 font-semibold">
            Owner
          </th>
          <th scope="col" className="py-2 pr-4 font-semibold">
            Last updated
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project, index) => (
          <tr key={`${project.id}-${String(index)}`} className="border-b border-slate-100">
            <th scope="row" className="py-2 pr-4 font-normal">
              <Link to={`/projects/${project.id}`} className="text-blue-600 hover:underline">
                {project.name}
              </Link>
            </th>
            <td className="py-2 pr-4 capitalize">{project.status}</td>
            <td className="py-2 pr-4">{project.owner.name}</td>
            <td className="py-2 pr-4">
              <time dateTime={project.lastUpdatedAt} title={project.lastUpdatedAt}>
                {formatLastUpdated(project.lastUpdatedAt)}
              </time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
