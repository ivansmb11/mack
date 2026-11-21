import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { DsaService } from "../src/dsa/dsa.service.js";
import { readEnvFile } from "../src/hermes/hermes.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { createTestApp, dsaSpec } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

describe("DSA creation", () => {
  it("creates an isolated Hermes profile wired for Matrix", async () => {
    t = await createTestApp();
    const mackDir = t.hermes.profileDir("mack");
    mkdirSync(mackDir, { recursive: true });
    writeFileSync(join(mackDir, ".env"), "ANTHROPIC_API_KEY=sk-test\nTELEGRAM_BOT_TOKEN=secret\n");
    const dsaDir = t.hermes.profileDir("finanzas");
    mkdirSync(dsaDir, { recursive: true });
    writeFileSync(join(dsaDir, ".env"), "API_SERVER_ENABLED=true\nAPI_SERVER_PORT=8650\n");

    const res = await t.api.post("/api/agents", dsaSpec({ budget: { monthlyTokens: 1000 } }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "finanzas", kind: "dsa", domains: ["gastos", "factura", "sat", "estado de cuenta"] });
    expect(t.vendored).toEqual(["demo"]);
    expect(t.hermes.served("finanzas")).toBe(true);

    const dir = t.hermes.profileDir("finanzas");
    expect(readFileSync(join(dir, "SOUL.md"), "utf8")).toMatch(/Contrato con Matrix/);
    const yaml = parse(readFileSync(join(dir, "config.yaml"), "utf8"));
    expect(yaml.model).toEqual({ provider: "anthropic", default: "claude-sonnet-5-5" });
    expect(yaml.skills.external_dirs).toEqual([join(t.root, "packs", "demo")]);

    const env = readEnvFile(join(dir, ".env"));
    expect(env.ANTHROPIC_API_KEY).toBe("sk-test");
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(Object.keys(env).filter((k) => /^API_SERVER_(ENABLED|PORT|HOST)$/.test(k))).toEqual([]);
    expect(env.API_SERVER_KEY).toHaveLength(64);
    expect(statSync(join(dir, ".env")).mode & 0o777).toBe(0o600);

    const budget = await t.get<PrismaService>(PrismaService).budget.findUnique({ where: { agentName: "finanzas" } });
    expect(budget).toMatchObject({ monthlyTokens: 1000, monthlyUsd: null });
  });

  it("accepts YAML specs and preserves config written by `hermes profile create`", async () => {
    t = await createTestApp();
    const dir = t.hermes.profileDir("viajes");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.yaml"), "terminal:\n  backend: local\nmodel:\n  provider: openrouter\n  base_url: x\n");

    const yaml = `name: viajes\ndescription: Planeación de viajes\ndomains: [vuelo, hotel]\nmodel: {provider: anthropic, default: claude-sonnet-5-5}\nsoul: "Eres el DSA de viajes de Iván."\n`;
    expect((await t.api.post("/api/agents", yaml, "application/yaml")).status).toBe(201);

    const config = parse(readFileSync(join(dir, "config.yaml"), "utf8"));
    expect(config.terminal.backend).toBe("local");
    expect(config.model).toEqual({ provider: "anthropic", default: "claude-sonnet-5-5", base_url: "x" });
  });

  it("parks and unparks DSAs on the host gateway", async () => {
    t = await createTestApp();
    await t.api.post("/api/agents", dsaSpec());
    expect((await t.api.post("/api/agents/finanzas/stop")).status).toBe(204);
    expect(t.hermes.served("finanzas")).toBe(false);
    expect((await t.api.post("/api/agents/finanzas/start")).status).toBe(204);
    expect(t.hermes.served("finanzas")).toBe(true);
    expect((await t.api.post("/api/agents/ghost/start")).status).toBe(404);
  });

  it("rejects bad specs with the right status", async () => {
    t = await createTestApp();
    await t.api.post("/api/agents", dsaSpec({ name: "a1" }));
    expect((await t.api.post("/api/agents", dsaSpec({ name: "a1" }))).status).toBe(409);
    expect((await t.api.post("/api/agents", dsaSpec({ name: "mack" }))).status).toBe(409);
    expect((await t.api.post("/api/agents", dsaSpec({ name: "Bad Name" }))).status).toBe(400);
    expect((await t.api.post("/api/agents", dsaSpec({ name: "x2", packs: ["nope"] }))).status).toBe(400);
  });

  it("provisions Mack without leaking MACK_TOKEN into the database", async () => {
    t = await createTestApp();
    const res = await t.api.post("/api/orchestrator/init", { start: false });
    expect(res.body).toMatchObject({ name: "mack", kind: "orchestrator" });
    expect(t.hermes.served("mack")).toBe(false);

    const config = parse(readFileSync(join(t.hermes.profileDir("mack"), "config.yaml"), "utf8"));
    expect(config.mcp_servers.mack.env.MACK_TOKEN).toBe("t".repeat(64));
    const stored = await t.get<PrismaService>(PrismaService).agent.findUnique({ where: { name: "mack" } });
    expect(JSON.stringify(stored!.spec)).not.toContain("t".repeat(64));
    expect(readFileSync(join(t.hermes.profileDir("mack"), "SOUL.md"), "utf8")).not.toMatch(/Contrato con Matrix/);

    expect((await t.api.delete("/api/agents/mack")).status).toBe(409);
  });

  it("removing a DSA deletes its profile, record and budget", async () => {
    t = await createTestApp();
    await t.api.post("/api/agents", dsaSpec({ budget: { monthlyUsd: 5 } }));
    expect((await t.api.delete("/api/agents/finanzas")).status).toBe(204);
    expect(await t.get<DsaService>(DsaService).get("finanzas")).toBeNull();
    expect(await t.get<PrismaService>(PrismaService).budget.count()).toBe(0);
  });
});
