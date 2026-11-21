import { z } from "zod";

const GIT_REF = /^[A-Za-z0-9._/-]+$/;

export const JobSpecSchema = z.object({
  repo: z.string().min(1),
  task: z.string().min(10),
  workflow: z.enum(["implement", "implement-review"]).default("implement-review"),
  branch: z.string().regex(GIT_REF).optional(),
  baseBranch: z.string().regex(GIT_REF).optional(),
  model: z.string().optional(),
  maxIterations: z.number().int().min(1).max(20).default(5),
  setupCommand: z.string().optional(),
});
export type JobSpec = z.output<typeof JobSpecSchema>;
