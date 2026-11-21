import "reflect-metadata";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import Database from "better-sqlite3";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { MACK_TOKEN } from "../src/auth/token.guard.js";
import { type MackConfig, MACK_CONFIG, PROJECT_ROOT } from "../src/config/config.js";
import { AGENT_RUNNER, type AgentRunner } from "../src/factory/agent-runner.js";
import { fakeHermes, HERMES } from "../src/hermes/hermes.js";
import { FETCH, type Fetch } from "../src/matrix/fetch.js";
import { configureApp } from "../src/main.js";
import { loadPacks } from "../src/packs/packs.js";
import { PacksService } from "../src/packs/packs.service.js";

export const TOKEN = "t".repeat(64);

function migratedDatabase(dir: string): string {
  const file = join(dir, "mack.db");
  const db = new Database(file);
  const migrations = join(PROJECT_ROOT, "prisma/migrations");
  for (const m of readdirSync(migrations).filter((d) => !d.endsWith(".toml")).sort())
    db.exec(readFileSync(join(migrations, m, "migration.sql"), "utf8"));
  db.close();
  return `file:${file}`;
}

export interface TestAppOptions {
  pricing?: MackConfig["pricing"];
  fetch?: Fetch;
  runner?: AgentRunner;
  maxConcurrent?: number;
}

export async function createTestApp(opts: TestAppOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), "mack-test-"));
  const repos = join(root, "repos");
  mkdirSync(repos);
  process.env.DATABASE_URL = migratedDatabase(root);

  const config: MackConfig = {
    domain: "mack.test",
    server: { host: "127.0.0.1", port: 7777 },
    hermes: {
      bin: "hermes",
      home: join(root, "hermes"),
      orchestrator: "mack",
      apiUrl: "http://127.0.0.1:8642",
      inheritEnv: ["ANTHROPIC_API_KEY"],
    },
    dataDir: root,
    factory: {
      imageName: "sandcastle:test",
      defaultModel: "claude-test",
      maxConcurrent: opts.maxConcurrent ?? 2,
      skillPack: "demo",
      repoRoots: [repos],
    },
    pricing: opts.pricing ?? {},
  };
  const hermes = fakeHermes(config.hermes.home);
  const vendored: string[] = [];
  const packs = {
    packs: new Map([
      ...loadPacks(join(PROJECT_ROOT, "packs")),
      ["demo", { name: "demo", description: "demo", repo: "x", commit: "abcdef1", skills: ["skills/a"] }],
    ]),
    resolve(names: string[]) {
      return names.map((n) => {
        const pack = this.packs.get(n);
        if (!pack) throw new BadRequestException(`Unknown skill pack "${n}"`);
        return pack;
      });
    },
    async vendor(pack: { name: string }) {
      vendored.push(pack.name);
      return join(root, "packs", pack.name);
    },
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MACK_CONFIG).useValue(config)
    .overrideProvider(MACK_TOKEN).useValue(TOKEN)
    .overrideProvider(HERMES).useValue(hermes)
    .overrideProvider(PacksService).useValue(packs)
    .overrideProvider(FETCH).useValue(opts.fetch ?? (async () => new Response("{}")))
    .overrideProvider(AGENT_RUNNER).useValue(opts.runner ?? (async () => ({ commits: [], completed: true, output: "" })))
    .compile();

  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>()) as NestExpressApplication;
  await app.init();
  const http = request(app.getHttpServer());
  const auth = { authorization: `Bearer ${TOKEN}` };

  return {
    app,
    moduleRef,
    root,
    repos,
    config,
    hermes,
    vendored,
    get: <T>(token: unknown) => moduleRef.get(token as never) as T,
    api: {
      get: (path: string) => http.get(path).set(auth),
      post: (path: string, body?: object | string, type = "application/json") =>
        http.post(path).set(auth).set("content-type", type).send(body ?? {}),
      put: (path: string, body: object) => http.put(path).set(auth).send(body),
      delete: (path: string) => http.delete(path).set(auth),
    },
    http,
  };
}

export const dsaSpec = (overrides: Record<string, unknown> = {}) => ({
  name: "finanzas",
  description: "Finanzas personales en México",
  domains: ["gastos", "factura", "sat", "estado de cuenta"],
  model: { provider: "anthropic", default: "claude-sonnet-5-5" },
  packs: ["demo"],
  soul: "# Finanzas\nEres el DSA de finanzas.",
  ...overrides,
});

export const chatReply = (content: string, usage = { prompt_tokens: 100, completion_tokens: 50 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), {
    headers: { "content-type": "application/json" },
  });
