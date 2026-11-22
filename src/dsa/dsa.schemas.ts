import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { AVATAR_IDS } from "./avatars.js";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const AgentSpecSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, "kebab-case, 2-31 chars, starts with a letter"),
  description: z.string().min(10),
  domains: z.array(z.string().min(2)).default([]),
  model: z.object({ provider: z.string(), default: z.string() }),
  packs: z.array(z.string()).default([]),
  skillDirs: z.array(z.string()).default([]),
  disabledToolsets: z.array(z.string()).default([]),
  mcpServers: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  budget: z
    .object({ monthlyTokens: z.number().int().positive().optional(), monthlyUsd: z.number().positive().optional() })
    .optional(),
  soul: z.string().min(20),
  color: z.string().regex(HEX_COLOR).optional(),
  avatar: z.enum(AVATAR_IDS).optional(),
});

export type AgentSpec = z.output<typeof AgentSpecSchema>;

export function loadTemplates(dir: string): Map<string, AgentSpec> {
  const specs = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => AgentSpecSchema.parse(parse(readFileSync(join(dir, f), "utf8"))));
  return new Map(specs.map((s) => [s.name, s]));
}

export const AgentPatchSchema = z
  .object({
    description: z.string().min(10),
    domains: z.array(z.string().min(2)),
    instructions: z.string().min(20),
    color: z.string().regex(HEX_COLOR).or(z.literal("")),
    avatar: z.enum(AVATAR_IDS).or(z.literal("")),
    model: z.object({ provider: z.string().min(1), default: z.string().min(1) }),
  })
  .partial();

export type AgentPatch = z.output<typeof AgentPatchSchema>;

export const LookQuerySchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  domains: z.array(z.string()).default([]),
});
