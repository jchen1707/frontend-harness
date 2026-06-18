// Service layer (feature-internal): business logic + data hooks composing
// the feature's own repositories. UI → services → repositories → core.
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

import { env } from '@/env';

import { HttpHealthRepository, type HealthRepository } from '../repositories/health';
import { type Health } from '../repositories/schemas/health';

const defaultRepository = new HttpHealthRepository();

export interface UseHealthOptions {
  repository?: HealthRepository;
  /** Defaults to `VITE_HEALTHCHECK_ENABLED` so the skeleton stays quiet by default. */
  enabled?: boolean;
}

export function useHealth(options: UseHealthOptions = {}): UseQueryResult<Health> {
  const { repository = defaultRepository, enabled = env.VITE_HEALTHCHECK_ENABLED } = options;
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => repository.getHealth(signal),
    enabled,
  });
}
