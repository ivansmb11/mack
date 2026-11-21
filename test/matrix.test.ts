import assert from "node:assert/strict";
import { test } from "node:test";
import { BudgetExceeded } from "../src/ledger.ts";
import { createMatrix, route } from "../src/matrix.ts";
import { dsaSpec, testSystem } from "./helpers.ts";

const reply = (content: string, usage = { prompt_tokens: 100, completion_tokens: 50 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), {
    headers: { "content-type": "application/json" },
  });

test("routes by domain keywords, accent-insensitive, preferring phrase matches", async () => {
  const { factory } = testSystem();
  await factory.create(dsaSpec());
  await factory.create(dsaSpec({ name: "dev", domains: ["bug", "typescript", "factura"] }));
  const agents = factory.list();

  assert.equal(route("Revisa mis GASTOS y el estado de cuenta de octubre", agents).agent, "finanzas");
  assert.equal(route("Hay un bug en el código TypeScript", agents).agent, "dev");
  assert.equal(route("¿Qué opinas del clima?", agents).agent, null);
  assert.equal(route("Descarga la factura del SAT", agents).candidates[0].agent, "finanzas");
});

test("dispatch calls the DSA API server with its own key and records usage", async () => {
  const { factory, ledger } = testSystem({ "claude-sonnet-5-5": { inputPerMTok: 1, outputPerMTok: 2 } });
  await factory.create(dsaSpec());
  const calls: { url: string; init: RequestInit }[] = [];
  const matrix = createMatrix({ factory, ledger, fetch: async (url, init) => (calls.push({ url: String(url), init: init! }), reply("listo")) });

  const result = await matrix.dispatch({ task: "Resume mis gastos", context: "MXN" });

  assert.deepEqual([result.agent, result.status, result.content], ["finanzas", "ok", "listo"]);
  assert.equal(calls[0].url, "http://127.0.0.1:8650/v1/chat/completions");
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, `Bearer ${factory.apiKey("finanzas")}`);
  const body = JSON.parse(calls[0].init.body as string);
  assert.equal(body.model, "finanzas");
  assert.deepEqual(body.messages[0], { role: "system", content: "MXN" });

  const spend = ledger.monthSpend("finanzas");
  assert.equal(spend.tokens, 150);
  assert.ok(Math.abs(spend.usd - 0.0002) < 1e-12);
});

test("dispatch refuses when the agent's budget is spent", async () => {
  const { factory, ledger } = testSystem();
  await factory.create(dsaSpec({ budget: { monthlyTokens: 100 } }));
  ledger.record("finanzas", "claude-sonnet-5-5", { prompt_tokens: 90, completion_tokens: 10 }, "test");
  const matrix = createMatrix({ factory, ledger, fetch: async () => assert.fail("must not call the DSA") });
  await assert.rejects(matrix.dispatch({ task: "gastos", agent: "finanzas" }), BudgetExceeded);
});

test("flags out-of-domain answers and isolates failures in fanout", async () => {
  const { factory, ledger } = testSystem();
  await factory.create(dsaSpec());
  await factory.create(dsaSpec({ name: "dev", domains: ["bug"] }));
  const matrix = createMatrix({
    factory,
    ledger,
    fetch: async (url) => {
      if (String(url).includes("8651")) throw new Error("connection refused");
      return reply("FUERA_DE_DOMINIO: no es finanzas");
    },
  });
  const results = await matrix.fanout([{ task: "a", agent: "finanzas" }, { task: "b", agent: "dev" }]);
  assert.deepEqual(results.map((r) => r.status), ["out_of_domain", "error"]);
  assert.match(results[1].content, /connection refused/);
});
