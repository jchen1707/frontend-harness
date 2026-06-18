// Repository layer (feature-internal): data access behind an interface.
// Within the feature the dependency rule still holds — repositories may
// depend only on core/env, never on services or UI.
import { request } from '@/core/http';

import { type Health, healthSchema } from './schemas/health';

export interface HealthRepository {
  getHealth(signal?: AbortSignal): Promise<Health>;
}

export class HttpHealthRepository implements HealthRepository {
  async getHealth(signal?: AbortSignal): Promise<Health> {
    const data = await request<unknown>('/healthz', signal ? { signal } : {});
    // Validate at the boundary before returning.
    return healthSchema.parse(data);
  }
}

export class FakeHealthRepository implements HealthRepository {
  constructor(private readonly health: Health = { status: 'ok', version: 'fake' }) {}

  getHealth(): Promise<Health> {
    return Promise.resolve(this.health);
  }
}
