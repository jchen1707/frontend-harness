// Repository layer (feature-internal): data access behind an interface.
// Within the feature the dependency rule still holds — repositories may
// depend only on core/env, never on services or UI.
import { ValidationError } from '@/core/errors';
import { request } from '@/core/http';
import { logger } from '@/core/logger';

import { type Project, projectListSchema } from './schemas/project';

export interface ProjectsRepository {
  listProjects(signal?: AbortSignal): Promise<Project[]>;
}

export class HttpProjectsRepository implements ProjectsRepository {
  async listProjects(signal?: AbortSignal): Promise<Project[]> {
    const data = await request<unknown>('/projects', signal ? { signal } : {});

    // Validate at the boundary before returning.
    const parsed = projectListSchema.safeParse(data);
    if (!parsed.success) {
      logger.error('Projects response failed validation', { issues: parsed.error.issues });
      throw new ValidationError('Projects response failed validation', { cause: parsed.error });
    }

    return parsed.data.projects;
  }
}

export class FakeProjectsRepository implements ProjectsRepository {
  constructor(private readonly projects: Project[] = []) {}

  listProjects(): Promise<Project[]> {
    return Promise.resolve(this.projects);
  }
}
