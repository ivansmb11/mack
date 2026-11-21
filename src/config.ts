import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

export const PROJECT_ROOT = resolve(import.meta.dirname, "..");

const expandHome = (p: string) => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

const PriceSchema = z.object({ inputPerMTok: z.number(), outputPerMTok: z.number() });

const ConfigSchema = z.object({
  domain: z.string(),
  server: z.object({ host: z.string(), port: z.number().int() }),
  hermes: z.object({
    bin: z.string(),
    home: z.string().transform(expandHome),
    orchestrator: z.string(),
    orchestratorPort: z.number().int(),
    dsaPortRange: z.tuple([z.number().int(), z.number().int()]),
    inheritEnv: z.array(z.string()),
  }),
  dataDir: z.string().transform(expandHome),
  pricing: z.record(z.string(), PriceSchema).nullish().transform((p) => p ?? {}),
});

export type MackConfig = z.infer<typeof ConfigSchema>;
export type Price = z.infer<typeof PriceSchema>;

export function loadConfig(path = process.env.MACK_CONFIG ?? join(PROJECT_ROOT, "mack.config.yaml")): MackConfig {
  const config = ConfigSchema.parse(parse(readFileSync(path, "utf8")));
  const envFile = join(config.dataDir, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  return config;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} (set it in ~/.mack/.env)`);
  return value;
}
