import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { PROJECT_ROOT } from "../src/config.ts";
import { loadTemplates } from "../src/factory.ts";
import { createMatrix } from "../src/matrix.ts";
import { dsaSpec, testSystem } from "./helpers.ts";

const TOKEN = "t".repeat(64);

function setup(fetchImpl: typeof fetch = async () => new Response("{}")) {
  const sys = testSystem();
  const matrix = createMatrix({ factory: sys.factory, ledger: sys.ledger, fetch: fetchImpl });
  const app = createApp({ ...sys, matrix, token: TOKEN, templates: loadTemplates(join(PROJECT_ROOT, "templates")), fetch: fetchImpl });
  const call = (path: string, init: RequestInit = {}, token = TOKEN) =>
    app.request(path, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers } });
  return { ...sys, app, call };
}

test("API requires MACK_TOKEN; healthz does not", async () => {
  const { app, call } = setup();
  assert.equal((await app.request("/healthz")).status, 200);
  assert.equal((await call("/api/agents", {}, "wrong")).status, 401);
  assert.equal((await call("/v1/models", {}, "wrong")).status, 401);
  assert.equal((await call("/api/agents")).status, 200);
});

test("creates a DSA from YAML and validates input", async () => {
  const { call } = setup();
  const yaml = `name: viajes\ndescription: Planeación de viajes\ndomains: [vuelo, hotel]\nmodel: {provider: anthropic, default: claude-sonnet-5-5}\nsoul: "Eres el DSA de viajes de Iván."\n`;
  const created = await call("/api/agents", { method: "POST", body: yaml, headers: { "content-type": "application/yaml" } });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).port, 8650);
  assert.equal((await call("/api/agents", { method: "POST", body: JSON.stringify({ name: "x" }) })).status, 400);
});

test("/v1 proxies to Mack with its own key and meters usage", async () => {
  let seen: { url: string; auth: string } | undefined;
  const { call, factory, ledger } = setup(async (url, init) => {
    seen = { url: String(url), auth: (init!.headers as Record<string, string>).authorization };
    return new Response(JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } }), {
      headers: { "content-type": "application/json" },
    });
  });
  await factory.create(dsaSpec({ name: "mack", domains: [] }), { kind: "orchestrator", start: false });

  const res = await call("/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "mack", messages: [] }) });

  assert.equal(res.status, 200);
  assert.equal(seen!.url, "http://127.0.0.1:8642/v1/chat/completions");
  assert.equal(seen!.auth, `Bearer ${factory.apiKey("mack")}`);
  assert.equal(ledger.monthSpend("mack").tokens, 10);
});

test("budget exhaustion surfaces as 402", async () => {
  const { call, factory, ledger } = setup();
  await factory.create(dsaSpec({ budget: { monthlyTokens: 1 } }));
  ledger.record("finanzas", "m", { prompt_tokens: 1, completion_tokens: 0 }, "t");
  const res = await call("/api/matrix/dispatch", { method: "POST", body: JSON.stringify({ task: "x", agent: "finanzas" }) });
  assert.equal(res.status, 402);
});

test("shipped templates are valid specs", () => {
  const templates = loadTemplates(join(PROJECT_ROOT, "templates"));
  assert.deepEqual([...templates.keys()].sort(), ["dev", "finanzas", "research"]);
  assert.deepEqual(templates.get("dev")!.packs, ["matt-pocock-engineering", "matt-pocock-thinking"]);
});
