import { afterEach, describe, expect, it } from "vitest";
import { DsaService } from "../src/dsa/dsa.service.js";
import { LedgerService } from "../src/ledger/ledger.service.js";
import { route } from "../src/matrix/route.js";
import { chatReply, createTestApp, dsaSpec } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

describe("route", () => {
  const agents = [
    { name: "finanzas", kind: "dsa" as const, domains: ["gastos", "factura", "sat", "estado de cuenta"] },
    { name: "dev", kind: "dsa" as const, domains: ["bug", "typescript", "factura"] },
    { name: "mack", kind: "orchestrator" as const, domains: ["gastos"] },
  ];

  it("matches domains accent- and case-insensitively, phrases weigh double, ignores the orchestrator", () => {
    expect(route("Revisa mis GASTOS y el estado de cuenta", agents)).toMatchObject({ agent: "finanzas", score: 3 });
    expect(route("Hay un bug en el código TypeScript", agents).agent).toBe("dev");
    expect(route("¿Qué opinas del clima?", agents).agent).toBeNull();
    expect(route("Descarga la factura del SAT", agents).candidates.map((c) => c.agent)).toEqual(["finanzas", "dev"]);
  });
});

describe("Matrix", () => {
  it("dispatches with the DSA's own key, auto-routes, and meters usage", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    t = await createTestApp({
      pricing: { "claude-sonnet-5-5": { inputPerMTok: 1, outputPerMTok: 2 } },
      fetch: async (url, init) => (calls.push({ url: String(url), init: init! }), chatReply("listo")),
    });
    await t.api.post("/api/agents", dsaSpec());

    const res = await t.api.post("/api/matrix/dispatch", { task: "Resume mis gastos", context: "MXN" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ agent: "finanzas", status: "ok", content: "listo" });
    expect(calls[0].url).toBe("http://127.0.0.1:8650/v1/chat/completions");
    const key = t.get<DsaService>(DsaService).apiKey("finanzas");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe(`Bearer ${key}`);
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ model: "finanzas", messages: [{ role: "system", content: "MXN" }, { role: "user" }] });

    const spend = await t.get<LedgerService>(LedgerService).monthSpend("finanzas");
    expect(spend.tokens).toBe(150);
    expect(spend.usd).toBeCloseTo(0.0002, 12);
  });

  it("refuses with 402 once the budget is spent, without calling the DSA", async () => {
    t = await createTestApp({ fetch: async () => expect.fail("must not call the DSA") });
    await t.api.post("/api/agents", dsaSpec({ budget: { monthlyTokens: 100 } }));
    await t.get<LedgerService>(LedgerService).record("finanzas", "m", { prompt_tokens: 90, completion_tokens: 10 }, "test");

    const res = await t.api.post("/api/matrix/dispatch", { task: "gastos", agent: "finanzas" });
    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/100 \/ 100 tokens/);
  });

  it("flags out-of-domain answers and isolates failures in fanout", async () => {
    t = await createTestApp({
      fetch: async (url) => {
        if (String(url).includes("8651")) throw new Error("connection refused");
        return chatReply("FUERA_DE_DOMINIO: no es finanzas");
      },
    });
    await t.api.post("/api/agents", dsaSpec());
    await t.api.post("/api/agents", dsaSpec({ name: "dev", domains: ["bug"] }));

    const res = await t.api.post("/api/matrix/fanout", [{ task: "a", agent: "finanzas" }, { task: "b", agent: "dev" }]);
    expect(res.body.map((r: { status: string }) => r.status)).toEqual(["out_of_domain", "error"]);
    expect(res.body[1].content).toMatch(/connection refused/);
  });
});
