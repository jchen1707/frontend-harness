import { QueryClient } from '@tanstack/react-query';

// TanStack Query client for REST server-state (caching, retries, dedup).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
