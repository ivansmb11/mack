import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

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
});

export type AgentSpec = z.output<typeof AgentSpecSchema>;

export function loadTemplates(dir: string): Map<string, AgentSpec> {
  const specs = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => AgentSpecSchema.parse(parse(readFileSync(join(dir, f), "utf8"))));
  return new Map(specs.map((s) => [s.name, s]));
}
