// Repository layer: data access behind an interface (mirror of the
// Embedder/VectorStore protocol+impls pattern in python-harness).
// Depend on the interface; inject the implementation at composition time.
import { request } from '@/core/http';
import { type Health, healthSchema } from '@/repositories/schemas/health';

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
