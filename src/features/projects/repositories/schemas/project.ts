import { z } from 'zod';

// Zod schemas for the Projects resource (ADR 0001).
// Repositories parse responses through these before data enters the app.

export const projectStatusSchema = z.enum(['active', 'paused', 'archived']);

export const projectOwnerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: projectStatusSchema,
  lastUpdatedAt: z.string().datetime(),
  owner: projectOwnerSchema,
});

export const projectListSchema = z.object({
  projects: z.array(projectSchema),
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectOwner = z.infer<typeof projectOwnerSchema>;
export type Project = z.infer<typeof projectSchema>;
