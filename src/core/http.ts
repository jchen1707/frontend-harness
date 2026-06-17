import { HttpError } from '@/core/errors';
import { env } from '@/env';

// Base fetch wrapper for the REST repository layer: JSON, timeouts, cancellation,
// and error mapping. GraphQL goes through Apollo (see apolloClient.ts) instead.
export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, signal, timeoutMs = 10_000 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        controller.abort();
      },
      { once: true },
    );
  }

  try {
    const init: RequestInit = {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      signal: controller.signal,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, init);
    if (!response.ok) {
      throw new HttpError(`Request failed: ${method} ${path}`, response.status);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
