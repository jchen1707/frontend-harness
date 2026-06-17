import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { FakeHealthRepository, HttpHealthRepository } from '@/repositories/health';
import { useHealth } from '@/services/health';

function makeWrapper(): (props: { children: ReactNode }) => JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useHealth', () => {
  it('returns health from an injected fake repository (fully offline)', async () => {
    const repository = new FakeHealthRepository({ status: 'ok', version: 'unit' });
    const { result } = renderHook(() => useHealth(repository), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ status: 'ok', version: 'unit' });
  });

  it('parses a Zod-validated response through the HTTP layer (MSW)', async () => {
    const { result } = renderHook(() => useHealth(new HttpHealthRepository()), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ status: 'ok', version: 'test' });
  });
});
