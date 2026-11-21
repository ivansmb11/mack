import { afterEach, describe, expect, it } from "vitest";
import { DsaService } from "../src/dsa/dsa.service.js";
import { LedgerService } from "../src/ledger/ledger.service.js";
import { createTestApp } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

describe("HTTP surface", () => {
  it("requires MACK_TOKEN everywhere except healthz and the dashboard", async () => {
    t = await createTestApp();
    expect((await t.http.get("/healthz")).body).toEqual({ ok: true, domain: "mack.test" });
    expect((await t.http.get("/")).text).toContain("MACK");
    expect((await t.http.get("/api/agents")).status).toBe(401);
    expect((await t.http.get("/api/agents").set("authorization", "Bearer wrong")).status).toBe(401);
    expect((await t.http.post("/v1/chat/completions")).status).toBe(401);
    expect((await t.api.get("/api/agents")).status).toBe(200);
  });

  it("/v1 proxies to Mack with its own key and meters usage", async () => {
    let seen: { url: string; auth: string; body: string } | undefined;
    t = await createTestApp({
      fetch: async (url, init) => {
        seen = { url: String(url), auth: (init!.headers as Record<string, string>).authorization, body: init!.body as string };
        return new Response(JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } }), {
          headers: { "content-type": "application/json" },
        });
      },
    });
    await t.api.post("/api/orchestrator/init", { start: false });

    const res = await t.api.post("/v1/chat/completions", { model: "mack", messages: [{ role: "user", content: "hola" }] });

    expect(res.status).toBe(200);
    expect(seen!.url).toBe("http://127.0.0.1:8642/p/mack/v1/chat/completions");
    expect(seen!.auth).toBe(`Bearer ${t.get<DsaService>(DsaService).apiKey("mack")}`);
    expect(JSON.parse(seen!.body).messages[0].content).toBe("hola");
    expect((await t.get<LedgerService>(LedgerService).monthSpend("mack")).tokens).toBe(10);
  });

  it("serves the DSA templates shipped in the repo", async () => {
    t = await createTestApp();
    const templates = (await t.api.get("/api/templates")).body;
    expect(templates.map((s: { name: string }) => s.name).sort()).toEqual(["dev", "finanzas", "research"]);
    expect(templates.find((s: { name: string }) => s.name === "dev").packs).toEqual(["matt-pocock-engineering", "matt-pocock-thinking"]);
  });
});
