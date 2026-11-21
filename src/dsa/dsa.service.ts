import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { parse } from "yaml";
import { MACK_TOKEN } from "../auth/token.guard.js";
import { type MackConfig, MACK_CONFIG, PROJECT_ROOT } from "../config/config.js";
import type { Agent, AgentKind, Prisma } from "../generated/prisma/client.js";
import { HERMES, type Hermes, patchConfigYaml, readEnvFile, writeEnvFile } from "../hermes/hermes.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { PacksService } from "../packs/packs.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { type AgentSpec, AgentSpecSchema, loadTemplates } from "./dsa.schemas.js";

export type AgentRecord = Omit<Agent, "domains" | "spec"> & { domains: string[] };

/** Only the key belongs in a named profile's .env; enabling a listener there would conflict with the host gateway. */
const LISTENER_ENV_KEYS = ["API_SERVER_ENABLED", "API_SERVER_HOST", "API_SERVER_PORT"];

/** Appended to every DSA's SOUL.md so it behaves as a worker of Matrix, not a standalone assistant. */
const DSA_CONTRACT = `
## Contrato con Matrix
- Eres un Domain Specific Agent (DSA) dentro del sistema Mack. Recibes tareas de Matrix, el orquestador; no hablas directo con el usuario.
- Responde con el resultado final, listo para que Mack lo presente. Si te falta información crítica, dilo explícitamente en una sección "Necesito" en vez de inventar.
- Si la tarea cae fuera de tu dominio, responde "FUERA_DE_DOMINIO: <motivo>" para que Matrix la reasigne.
- Idioma por defecto: español.
`;

/** MCP server configs carry secrets in `env` (e.g. MACK_TOKEN); the DB keeps only their names. */
const storableSpec = (spec: AgentSpec): Prisma.InputJsonObject =>
  JSON.parse(JSON.stringify({ ...spec, mcpServers: Object.keys(spec.mcpServers) }));

const toRecord = ({ spec: _spec, domains, ...agent }: Agent): AgentRecord => ({ ...agent, domains: domains as string[] });

/** Creates DSAs (and Mack itself) as isolated Hermes profiles, each with its own API server and key. */
@Injectable()
export class DsaService {
  readonly templates: Map<string, AgentSpec> = loadTemplates(join(PROJECT_ROOT, "templates"));

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly packs: PacksService,
    @Inject(HERMES) private readonly hermes: Hermes,
    @Inject(MACK_CONFIG) private readonly config: MackConfig,
    @Inject(MACK_TOKEN) private readonly token: string,
  ) {}

  /** Provisions Mack: its SOUL, the mack-* skills and the MCP bridge back to this control plane. */
  initOrchestrator(opts: { start?: boolean } = {}): Promise<AgentRecord> {
    const spec = parse(readFileSync(join(PROJECT_ROOT, "hermes/mack.yaml"), "utf8"));
    const { host, port } = this.config.server;
    return this.create(
      {
        ...spec,
        skillDirs: [join(PROJECT_ROOT, "hermes/skills")],
        mcpServers: {
          mack: {
            command: process.execPath,
            args: [join(PROJECT_ROOT, "dist/mcp.js")],
            env: { MACK_URL: `http://${host}:${port}`, MACK_TOKEN: this.token },
          },
        },
      },
      { kind: "orchestrator", start: opts.start },
    );
  }

  async list(): Promise<AgentRecord[]> {
    const agents = await this.prisma.agent.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });
    return agents.map(toRecord);
  }

  async get(name: string): Promise<AgentRecord | null> {
    const agent = await this.prisma.agent.findUnique({ where: { name } });
    return agent && toRecord(agent);
  }

  async require(name: string): Promise<AgentRecord> {
    const agent = await this.get(name);
    if (!agent) throw new NotFoundException(`Agent "${name}" not found`);
    return agent;
  }

  /** OpenAI-compatible base URL of a profile behind the Hermes host gateway. */
  baseUrl(name: string): string {
    return `${this.config.hermes.apiUrl}/p/${name}/v1`;
  }

  apiKey(name: string): string {
    const key = readEnvFile(join(this.hermes.profileDir(name), ".env")).API_SERVER_KEY;
    if (!key) throw new NotFoundException(`Agent ${name} has no API_SERVER_KEY`);
    return key;
  }

  async create(input: unknown, opts: { kind?: AgentKind; start?: boolean } = {}): Promise<AgentRecord> {
    const spec = AgentSpecSchema.parse(input);
    const kind = opts.kind ?? "dsa";
    if (await this.get(spec.name)) throw new ConflictException(`Agent "${spec.name}" already exists`);
    if (kind === "dsa" && spec.name === this.config.hermes.orchestrator)
      throw new ConflictException(`"${spec.name}" is reserved for the orchestrator`);

    const packDirs = await Promise.all(this.packs.resolve(spec.packs).map((p) => this.packs.vendor(p)));
    await this.hermes.createProfile(spec.name);
    const dir = this.hermes.profileDir(spec.name);

    writeFileSync(join(dir, "SOUL.md"), kind === "dsa" ? spec.soul.trimEnd() + "\n" + DSA_CONTRACT : spec.soul);
    patchConfigYaml(join(dir, "config.yaml"), {
      model: spec.model,
      skills: { external_dirs: [...packDirs, ...spec.skillDirs] },
      ...(spec.disabledToolsets.length ? { agent: { disabled_toolsets: spec.disabledToolsets } } : {}),
      ...(Object.keys(spec.mcpServers).length ? { mcp_servers: spec.mcpServers } : {}),
    });

    const envPath = join(dir, ".env");
    writeEnvFile(
      envPath,
      {
        ...(kind === "dsa" ? this.inheritedSecrets() : {}),
        API_SERVER_KEY: readEnvFile(envPath).API_SERVER_KEY ?? randomBytes(32).toString("hex"),
      },
      { drop: LISTENER_ENV_KEYS },
    );

    await this.prisma.agent.create({
      data: {
        name: spec.name,
        kind,
        description: spec.description,
        domains: spec.domains,
        provider: spec.model.provider,
        model: spec.model.default,
        spec: storableSpec(spec),
        ...(spec.budget && {
          budget: { create: { monthlyTokens: spec.budget.monthlyTokens ?? null, monthlyUsd: spec.budget.monthlyUsd ?? null } },
        }),
      },
    });

    if (!(opts.start ?? true)) await this.hermes.park(spec.name);
    return this.require(spec.name);
  }

  async remove(name: string): Promise<void> {
    const agent = await this.require(name);
    if (agent.kind === "orchestrator") throw new ConflictException("The orchestrator cannot be removed");
    await this.hermes.deleteProfile(name);
    await this.prisma.agent.delete({ where: { name } });
  }

  async start(name: string) {
    await this.require(name);
    await this.hermes.serve(name);
  }

  async stop(name: string) {
    await this.require(name);
    await this.hermes.park(name);
  }

  private inheritedSecrets(): Record<string, string> {
    const orchestratorEnv = readEnvFile(join(this.hermes.profileDir(this.config.hermes.orchestrator), ".env"));
    return Object.fromEntries(
      this.config.hermes.inheritEnv.filter((k) => orchestratorEnv[k]).map((k) => [k, orchestratorEnv[k]]),
    );
  }
}
