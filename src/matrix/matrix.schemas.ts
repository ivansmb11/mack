import { z } from "zod";

export const DispatchSchema = z.object({
  task: z.string().min(1),
  agent: z.string().optional(),
  context: z.string().optional(),
});
export type DispatchRequest = z.output<typeof DispatchSchema>;

export const FanoutSchema = z.array(DispatchSchema).min(1);
