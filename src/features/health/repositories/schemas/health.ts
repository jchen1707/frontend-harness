import { z } from 'zod';

// Zod schema = boundary validation (the frontend analog of Pydantic models).
// Repositories parse responses through this before data enters the app.
export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  version: z.string(),
});

export type Health = z.infer<typeof healthSchema>;
