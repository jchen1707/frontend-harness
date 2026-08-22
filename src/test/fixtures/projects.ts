import { type Project, type ProjectStatus } from '@/features/projects/repositories/schemas/project';

const STATUSES: ProjectStatus[] = ['active', 'paused', 'archived'];
const BASE_DATE = new Date('2026-08-01T12:00:00.000Z');

// Deterministic fixture factory. No randomness, so tests and the dev worker see the same data.
export function makeProjects(count: number): Project[] {
  return Array.from({ length: count }, (_, index): Project => {
    const number = index + 1;
    const status = STATUSES[index % STATUSES.length] ?? 'active';

    return {
      id: `project-${String(number)}`,
      name: `Project ${String(number)}`,
      status,
      lastUpdatedAt: new Date(BASE_DATE.getTime() - index * 60 * 60 * 1000).toISOString(),
      owner: {
        id: `owner-${String(number)}`,
        name: `Owner ${String(number)}`,
      },
    };
  });
}

// Default set used by the mock API and by FRO-6's by-hand large-list check.
export const defaultProjects = makeProjects(3);
