import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

export const PROJECT_ROOT = findProjectRoot(import.meta.dirname);

const expandHome = (p: string) => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

const PriceSchema = z.object({ inputPerMTok: z.number(), outputPerMTok: z.number() });

const ConfigSchema = z.object({
  domain: z.string(),
  server: z.object({ host: z.string(), port: z.number().int() }),
  hermes: z.object({
    bin: z.string(),
    home: z.string().transform(expandHome),
    orchestrator: z.string(),
    apiUrl: z.url().transform((u) => u.replace(/\/$/, "")),
    inheritEnv: z.array(z.string()),
  }),
  dataDir: z.string().transform(expandHome),
  factory: z.object({
    imageName: z.string(),
    defaultModel: z.string(),
    maxConcurrent: z.number().int().min(1),
    skillPack: z.string(),
    repoRoots: z.array(z.string().transform(expandHome)).min(1),
  }),
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

/** Works from both src/ (tests) and dist/ (runtime): the root is the nearest dir with mack.config.yaml. */
function findProjectRoot(from: string): string {
  for (let dir = from; dir !== dirname(dir); dir = dirname(dir)) if (existsSync(join(dir, "mack.config.yaml"))) return dir;
  throw new Error(`mack.config.yaml not found above ${from}`);
}

export const MACK_CONFIG = Symbol("MACK_CONFIG");
