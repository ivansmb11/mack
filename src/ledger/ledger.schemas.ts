import { z } from "zod";

export const SubscriptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  provider: z.string(),
  plan: z.string(),
  monthlyUsd: z.number().nonnegative(),
  renewsOn: z.iso.date().nullable().default(null),
  monthlyTokenQuota: z.number().int().positive().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type SubscriptionInput = z.output<typeof SubscriptionSchema>;

export const BudgetSchema = z.object({
  monthlyTokens: z.number().int().positive().nullable().default(null),
  monthlyUsd: z.number().positive().nullable().default(null),
});
export type BudgetInput = z.output<typeof BudgetSchema>;

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}
