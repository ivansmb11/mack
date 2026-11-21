import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { MackConfig } from "./config.ts";
import type { Db } from "./db.ts";
import { type Hermes, patchConfigYaml, readEnvFile, writeEnvFile } from "./hermes.ts";
import type { Ledger } from "./ledger.ts";
import type { SkillPack } from "./packs.ts";

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

export type AgentSpec = z.infer<typeof AgentSpecSchema>;
export type AgentKind = "orchestrator" | "dsa";

export interface AgentRecord {
  name: string;
  kind: AgentKind;
  description: string;
  domains: string[];
  port: number;
  provider: string;
  model: string;
  createdAt: string;
}

/** Appended to every DSA's SOUL.md so it behaves as a worker of Matrix, not a standalone assistant. */
const DSA_CONTRACT = `
## Contrato con Matrix
- Eres un Domain Specific Agent (DSA) dentro del sistema Mack. Recibes tareas de Matrix, el orquestador; no hablas directo con el usuario.
- Responde con el resultado final, listo para que Mack lo presente. Si te falta información crítica, dilo explícitamente en una sección "Necesito" en vez de inventar.
- Si la tarea cae fuera de tu dominio, responde "FUERA_DE_DOMINIO: <motivo>" para que Matrix la reasigne.
- Idioma por defecto: español.
`;

export interface FactoryDeps {
  db: Db;
  hermes: Hermes;
  config: MackConfig;
  ledger: Ledger;
  packs: Map<string, SkillPack>;
  vendorPack: (pack: SkillPack) => Promise<string>;
}

export function loadTemplates(dir: string): Map<string, AgentSpec> {
  const specs = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => AgentSpecSchema.parse(parse(readFileSync(join(dir, f), "utf8"))));
  return new Map(specs.map((s) => [s.name, s]));
}

const toRecord = (row: Record<string, unknown>): AgentRecord => ({
  name: row.name as string,
  kind: row.kind as AgentKind,
  description: row.description as string,
  domains: JSON.parse(row.domains as string),
  port: row.port as number,
  provider: row.provider as string,
  model: row.model as string,
  createdAt: row.created_at as string,
});

export function createFactory({ db, hermes, config, ledger, packs, vendorPack }: FactoryDeps) {
  const get = (name: string): AgentRecord | null => {
    const row = db.prepare("select * from agents where name = ?").get(name);
    return row ? toRecord(row as Record<string, unknown>) : null;
  };

  const allocatePort = (): number => {
    const used = new Set((db.prepare("select port from agents").all() as { port: number }[]).map((r) => r.port));
    const [from, to] = config.hermes.dsaPortRange;
    for (let port = from; port <= to; port++) if (!used.has(port)) return port;
    throw new Error(`No free DSA ports in ${from}-${to}`);
  };

  const inheritedSecrets = (): Record<string, string> => {
    const orchestratorEnv = readEnvFile(join(hermes.profileDir(config.hermes.orchestrator), ".env"));
    return Object.fromEntries(config.hermes.inheritEnv.filter((k) => orchestratorEnv[k]).map((k) => [k, orchestratorEnv[k]]));
  };

  const resolvePacks = (names: string[]): SkillPack[] =>
    names.map((name) => {
      const pack = packs.get(name);
      if (!pack) throw new Error(`Unknown skill pack "${name}". Available: ${[...packs.keys()].join(", ")}`);
      return pack;
    });

  return {
    list(): AgentRecord[] {
      return (db.prepare("select * from agents order by kind desc, name").all() as Record<string, unknown>[]).map(toRecord);
    },

    get,

    apiKey(name: string): string {
      const key = readEnvFile(join(hermes.profileDir(name), ".env")).API_SERVER_KEY;
      if (!key) throw new Error(`Agent ${name} has no API_SERVER_KEY`);
      return key;
    },

    async create(input: unknown, opts: { kind?: AgentKind; start?: boolean } = {}): Promise<AgentRecord> {
      const spec = AgentSpecSchema.parse(input);
      const kind = opts.kind ?? "dsa";
      if (get(spec.name)) throw new Error(`Agent "${spec.name}" already exists`);
      if (kind === "dsa" && spec.name === config.hermes.orchestrator)
        throw new Error(`"${spec.name}" is reserved for the orchestrator`);

      const skillPacks = resolvePacks(spec.packs);
      const packDirs = await Promise.all(skillPacks.map(vendorPack));
      const port = kind === "orchestrator" ? config.hermes.orchestratorPort : allocatePort();

      await hermes.createProfile(spec.name);
      const dir = hermes.profileDir(spec.name);

      writeFileSync(join(dir, "SOUL.md"), kind === "dsa" ? spec.soul.trimEnd() + "\n" + DSA_CONTRACT : spec.soul);
      patchConfigYaml(join(dir, "config.yaml"), {
        model: spec.model,
        skills: { external_dirs: [...packDirs, ...spec.skillDirs] },
        ...(spec.disabledToolsets.length ? { agent: { disabled_toolsets: spec.disabledToolsets } } : {}),
        ...(Object.keys(spec.mcpServers).length ? { mcp_servers: spec.mcpServers } : {}),
      });

      const envPath = join(dir, ".env");
      writeEnvFile(envPath, {
        ...(kind === "dsa" ? inheritedSecrets() : {}),
        API_SERVER_ENABLED: "true",
        API_SERVER_HOST: "127.0.0.1",
        API_SERVER_PORT: String(port),
        API_SERVER_KEY: readEnvFile(envPath).API_SERVER_KEY ?? randomBytes(32).toString("hex"),
      });

      db.prepare(
        "insert into agents (name, kind, description, domains, port, provider, model, spec) values (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(spec.name, kind, spec.description, JSON.stringify(spec.domains), port, spec.model.provider, spec.model.default, JSON.stringify(spec));

      if (spec.budget)
        ledger.setBudget(spec.name, { monthlyTokens: spec.budget.monthlyTokens ?? null, monthlyUsd: spec.budget.monthlyUsd ?? null });

      if (opts.start ?? true) await hermes.startGateway(spec.name);
      return get(spec.name)!;
    },

    async remove(name: string): Promise<void> {
      const agent = get(name);
      if (!agent) throw new Error(`Agent "${name}" not found`);
      if (agent.kind === "orchestrator") throw new Error("The orchestrator cannot be removed through the Factory");
      await hermes.deleteProfile(name);
      db.prepare("delete from agents where name = ?").run(name);
      db.prepare("delete from budgets where agent = ?").run(name);
    },

    start: (name: string) => hermes.startGateway(name),
    stop: (name: string) => hermes.stopGateway(name),
  };
}

export type Factory = ReturnType<typeof createFactory>;
