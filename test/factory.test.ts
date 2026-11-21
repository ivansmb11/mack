import assert from "node:assert/strict";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { readEnvFile } from "../src/hermes.ts";
import { dsaSpec, testSystem } from "./helpers.ts";

test("creates an isolated Hermes profile wired for Matrix", async () => {
  const { factory, hermes, config, vendored, ledger } = testSystem();
  const mackDir = hermes.profileDir("mack");
  mkdirSync(mackDir, { recursive: true });
  writeFileSync(join(mackDir, ".env"), "ANTHROPIC_API_KEY=sk-test\nTELEGRAM_BOT_TOKEN=secret\n");

  const agent = await factory.create(dsaSpec({ budget: { monthlyTokens: 1000 } }));

  assert.equal(agent.port, 8650);
  assert.deepEqual(vendored, ["demo"]);
  assert.ok(hermes.gateways.has("finanzas"));

  const dir = hermes.profileDir("finanzas");
  assert.match(readFileSync(join(dir, "SOUL.md"), "utf8"), /Contrato con Matrix/);

  const yaml = parse(readFileSync(join(dir, "config.yaml"), "utf8"));
  assert.deepEqual(yaml.model, { provider: "anthropic", default: "claude-sonnet-5-5" });
  assert.deepEqual(yaml.skills.external_dirs, [join(config.dataDir, "packs", "demo")]);

  const env = readEnvFile(join(dir, ".env"));
  assert.equal(env.ANTHROPIC_API_KEY, "sk-test");
  assert.equal(env.TELEGRAM_BOT_TOKEN, undefined, "messaging tokens stay with Mack");
  assert.equal(env.API_SERVER_PORT, "8650");
  assert.equal(env.API_SERVER_HOST, "127.0.0.1");
  assert.equal(env.API_SERVER_KEY.length, 64);
  assert.equal(statSync(join(dir, ".env")).mode & 0o777, 0o600);

  assert.deepEqual(ledger.getBudget("finanzas"), { monthlyTokens: 1000, monthlyUsd: null });
});

test("preserves config written by `hermes profile create`", async () => {
  const { factory, hermes } = testSystem();
  const dir = hermes.profileDir("finanzas");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.yaml"), "terminal:\n  backend: local\nmodel:\n  provider: openrouter\n  base_url: x\n");

  await factory.create(dsaSpec());

  const yaml = parse(readFileSync(join(dir, "config.yaml"), "utf8"));
  assert.equal(yaml.terminal.backend, "local");
  assert.equal(yaml.model.provider, "anthropic");
  assert.equal(yaml.model.base_url, "x");
});

test("allocates distinct ports and fails when the range is exhausted", async () => {
  const { factory } = testSystem();
  const ports = [];
  for (const name of ["a1", "a2", "a3"]) ports.push((await factory.create(dsaSpec({ name }))).port);
  assert.deepEqual(ports, [8650, 8651, 8652]);
  await assert.rejects(factory.create(dsaSpec({ name: "a4" })), /No free DSA ports/);
});

test("rejects duplicates, the orchestrator name, unknown packs and invalid names", async () => {
  const { factory } = testSystem();
  await factory.create(dsaSpec());
  await assert.rejects(factory.create(dsaSpec()), /already exists/);
  await assert.rejects(factory.create(dsaSpec({ name: "mack" })), /reserved/);
  await assert.rejects(factory.create(dsaSpec({ name: "x2", packs: ["nope"] })), /Unknown skill pack/);
  await assert.rejects(factory.create(dsaSpec({ name: "Bad Name" })), /kebab-case/);
});

test("orchestrator gets the fixed port, no DSA contract, and cannot be removed", async () => {
  const { factory, hermes } = testSystem();
  const mack = await factory.create(dsaSpec({ name: "mack", domains: [] }), { kind: "orchestrator", start: false });
  assert.equal(mack.port, 8642);
  assert.doesNotMatch(readFileSync(join(hermes.profileDir("mack"), "SOUL.md"), "utf8"), /Contrato con Matrix/);
  await assert.rejects(factory.remove("mack"), /cannot be removed/);
});

test("remove deletes profile, record and budget", async () => {
  const { factory, ledger } = testSystem();
  await factory.create(dsaSpec({ budget: { monthlyUsd: 5 } }));
  await factory.remove("finanzas");
  assert.equal(factory.get("finanzas"), null);
  assert.equal(ledger.getBudget("finanzas"), null);
});
