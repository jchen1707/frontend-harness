import { z } from 'zod';

// Single place env is read and validated (mirror of python-harness app.config.Settings).
// Only VITE_-prefixed vars reach the browser. Defaults keep the skeleton runnable
// without a .env file; override per environment.
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8000'),
  VITE_GRAPHQL_URL: z.string().url().default('http://localhost:8000/graphql'),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(import.meta.env);
