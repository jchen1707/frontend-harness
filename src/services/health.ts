// Service layer: business logic + data hooks composing repositories.
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

import { HttpHealthRepository, type HealthRepository } from '@/repositories/health';
import { type Health } from '@/repositories/schemas/health';

const defaultRepository = new HttpHealthRepository();

export function useHealth(
  repository: HealthRepository = defaultRepository,
): UseQueryResult<Health> {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => repository.getHealth(signal),
  });
}
