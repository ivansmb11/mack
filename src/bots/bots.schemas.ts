import { z } from "zod";
import { AttachmentSchema, MAX_ATTACHMENTS } from "./attachments.js";

export const ChatSchema = z
  .object({
    message: z.string().trim().max(20_000).default(""),
    attachments: z.array(AttachmentSchema).max(MAX_ATTACHMENTS).default([]),
  })
  .refine((c) => c.message || c.attachments.length, "Escribe un mensaje o adjunta algo");

export const ApprovalSchema = z.object({
  choice: z.enum(["once", "session", "always", "deny"]),
  requestId: z.string().optional(),
});

export const RoutineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(5_000),
  /** Cron expression ("0 7 * * 1-5") or Hermes shorthand ("every 2h", "in 30m"). */
  schedule: z.string().trim().min(1),
  timezone: z.string().optional(),
});
export const RoutinePatchSchema = RoutineSchema.partial();
export type RoutineInput = z.output<typeof RoutineSchema>;

const MEMBER = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);
export const GroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  members: z.array(MEMBER).min(1).max(8),
});
export const GroupPatchSchema = GroupSchema.partial();
export type GroupInput = z.output<typeof GroupSchema>;

export const GroupMessageSchema = z.object({ content: z.string().trim().min(1).max(20_000) });
