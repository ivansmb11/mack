import { mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toChat } from "../src/bots/bots.service.js";
import { mentions } from "../src/bots/groups.service.js";
import { DSA_CONTRACT } from "../src/dsa/dsa.service.js";
import { LedgerService } from "../src/ledger/ledger.service.js";
import { chatReply, createTestApp, dsaSpec } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const sse = (...events: [string, unknown][]) =>
  new Response(events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });

type Call = { url: string; method: string; body: Record<string, unknown> | null };

/** Records calls and answers from a route table keyed by "METHOD path-suffix". */
function fakeHermes(routes: Record<string, (call: Call) => Response>) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null };
    calls.push(call);
    const key = Object.keys(routes).find((k) => {
      const [method, suffix] = k.split(" ");
      return method === call.method && call.url.split("?")[0].endsWith(suffix);
    });
    if (!key) throw new Error(`unexpected ${call.method} ${call.url}`);
    return routes[key](call);
  };
  return { calls, fetch };
}

describe("toChat", () => {
  it("keeps what a person reads and attaches the tools used to the reply", () => {
    const chat = toChat([
      { id: 1, role: "user", content: "¿gastos?", tool_calls: null, tool_name: null, timestamp: 1 },
      { id: 2, role: "assistant", content: "", tool_calls: [{ function: { name: "ledger_summary" } }], tool_name: null, timestamp: 2 },
      { id: 3, role: "tool", content: "{...}", tool_calls: null, tool_name: "ledger_summary", timestamp: 3 },
      { id: 4, role: "assistant", content: "Llevas $12", tool_calls: null, tool_name: null, timestamp: 4 },
      { id: 5, role: "session_meta", content: null, tool_calls: null, tool_name: null, timestamp: 5 },
    ]);
    expect(chat).toEqual([
      { id: "1", role: "user", content: "¿gastos?", toolsUsed: [], at: new Date(1000).toISOString() },
      { id: "4", role: "assistant", content: "Llevas $12", toolsUsed: ["ledger_summary"], at: new Date(4000).toISOString() },
    ]);
  });
});

describe("mentions", () => {
  it("returns group members in order of appearance, once", () => {
    expect(mentions("@dev y @finanzas, luego @dev otra vez y @nadie", ["finanzas", "dev"])).toEqual(["dev", "finanzas"]);
  });
});

describe("Bots", () => {
  it("opens one continuous thread per bot, relays the stream and meters the turn", async () => {
    const hermes = fakeHermes({
      "POST /p/finanzas/api/sessions": () => json({ session: { id: "mack-finanzas" } }, 201),
      "POST /api/sessions/mack-finanzas/chat/stream": () =>
        sse(
          ["assistant.delta", { delta: "hola" }],
          ["run.completed", { usage: { input_tokens: 70, output_tokens: 30 } }],
          ["done", {}],
        ),
    });
    t = await createTestApp({ fetch: hermes.fetch });
    await t.api.post("/api/agents", dsaSpec());

    const first = await t.api.post("/api/bots/finanzas/chat", { message: "hola" });
    await t.api.post("/api/bots/finanzas/chat", { message: "¿y ahora?" });

    expect(first.status).toBe(200);
    expect(first.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(first.text).toContain("event: assistant.delta");
    expect(hermes.calls.filter((c) => c.url.endsWith("/api/sessions"))).toHaveLength(1);
    expect(hermes.calls.find((c) => c.url.endsWith("/chat/stream"))?.body).toMatchObject({ message: "hola" });
    expect((await t.get<LedgerService>(LedgerService).monthSpend("finanzas")).tokens).toBe(200);
  });

  it("refuses to chat past the budget without touching Hermes", async () => {
    t = await createTestApp({ fetch: async () => expect.fail("must not call Hermes") });
    await t.api.post("/api/agents", dsaSpec({ budget: { monthlyTokens: 10 } }));
    await t.get<LedgerService>(LedgerService).record("finanzas", "m", { prompt_tokens: 10, completion_tokens: 0 }, "test");

    expect((await t.api.post("/api/bots/finanzas/chat", { message: "hola" })).status).toBe(402);
  });

  it("edits instructions, color and model, keeping the contract in SOUL.md", async () => {
    t = await createTestApp();
    await t.api.post("/api/agents", dsaSpec());

    const res = await t.http
      .patch("/api/bots/finanzas")
      .set("authorization", `Bearer ${"t".repeat(64)}`)
      .send({ instructions: "# Finanzas\nAhora también ves inversiones.", color: "#ff8800", model: { provider: "anthropic", default: "claude-haiku-5-5" } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ color: "#ff8800", model: "claude-haiku-5-5" });
    const soul = readFileSync(join(t.hermes.profileDir("finanzas"), "SOUL.md"), "utf8");
    expect(soul).toContain("Ahora también ves inversiones.");
    expect(soul).toContain(DSA_CONTRACT.trim());
    expect((await t.api.get("/api/bots/finanzas")).body.instructions).toBe("# Finanzas\nAhora también ves inversiones.");
  });

  it("creates routines as Hermes cron jobs and reads their run history from the profile", async () => {
    const hermes = fakeHermes({
      "POST /p/finanzas/api/jobs": ({ body }) =>
        json({ job: { id: "abcdef123456", ...body, schedule_display: body!.schedule, enabled: true, state: "scheduled", next_run_at: null, last_run_at: null, last_status: null, last_error: null } }),
    });
    t = await createTestApp({ fetch: hermes.fetch });
    await t.api.post("/api/agents", dsaSpec());
    const out = join(t.hermes.profileDir("finanzas"), "cron", "output", "abcdef123456");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "2026-11-20_07-00-01.md"), "resumen viejo");
    writeFileSync(join(out, "2026-11-21_07-00-02.md"), "resumen nuevo");
    utimesSync(join(out, "2026-11-20_07-00-01.md"), new Date("2026-11-20T13:00:01Z"), new Date("2026-11-20T13:00:01Z"));
    utimesSync(join(out, "2026-11-21_07-00-02.md"), new Date("2026-11-21T13:00:02Z"), new Date("2026-11-21T13:00:02Z"));

    const created = await t.api.post("/api/bots/finanzas/routines", { name: "Corte", prompt: "Resume gastos", schedule: "0 7 * * 1-5" });
    const runs = await t.api.get("/api/bots/finanzas/routines/abcdef123456/runs");

    expect(created.body).toMatchObject({ id: "abcdef123456", schedule: "0 7 * * 1-5", enabled: true });
    expect(hermes.calls[0].body).toMatchObject({ deliver: "local" });
    expect(runs.body).toEqual([
      { id: "2026-11-21_07-00-02", at: "2026-11-21T13:00:02.000Z", output: "resumen nuevo", failed: false },
      { id: "2026-11-20_07-00-01", at: "2026-11-20T13:00:01.000Z", output: "resumen viejo", failed: false },
    ]);
    expect((await t.api.get("/api/bots/finanzas/routines/../../etc/runs")).status).not.toBe(200);
    expect((await t.api.post("/api/bots/finanzas/routines/abcdef123456/explode")).status).toBe(404);
  });
});

describe("Groups", () => {
  async function setup(reply: (agent: string, prompt: string) => string) {
    const asked: string[] = [];
    t = await createTestApp({
      fetch: async (url, init) => {
        const agent = String(url).match(/\/p\/([^/]+)\//)![1];
        asked.push(agent);
        const { messages } = JSON.parse(String(init!.body));
        return chatReply(reply(agent, messages.at(-1).content));
      },
    });
    await t.api.post("/api/agents", dsaSpec());
    await t.api.post("/api/agents", dsaSpec({ name: "dev", domains: ["bug", "typescript"] }));
    const group = (await t.api.post("/api/groups", { name: "Lanzamiento", members: ["finanzas", "dev"] })).body;
    return { asked, group };
  }

  it("lets the mentioned bot answer and hands off when it mentions another member", async () => {
    const { asked, group } = await setup((agent) => (agent === "finanzas" ? "Cuesta $40. @dev ¿cabe en el sprint?" : "Sí cabe."));

    const res = await t.api.post(`/api/groups/${group.id}/messages`, { content: "@finanzas ¿cuánto cuesta el plan?" });

    expect(res.text).toContain("event: typing");
    expect(asked).toEqual(["finanzas", "dev"]);
    const history = (await t.api.get(`/api/groups/${group.id}/messages`)).body;
    expect(history.map((m: { author: string }) => m.author)).toEqual(["user", "finanzas", "dev"]);
  });

  it("gives the dev bot the whole transcript and routes unmentioned messages through Matrix", async () => {
    const prompts: string[] = [];
    const { asked, group } = await setup((_, prompt) => (prompts.push(prompt), "listo"));

    await t.api.post(`/api/groups/${group.id}/messages`, { content: "hay un bug en typescript" });

    expect(asked).toEqual(["dev"]);
    expect(prompts[0]).toContain("[Iván]: hay un bug en typescript");
    expect(prompts[0]).toContain("Te toca a ti, @dev.");
  });

  it("stops bots that keep pinging each other", async () => {
    const { asked, group } = await setup((agent) => (agent === "finanzas" ? "@dev" : "@finanzas"));

    await t.api.post(`/api/groups/${group.id}/messages`, { content: "@finanzas empieza" });

    expect(asked).toHaveLength(6);
  });

  it("rejects members that don't exist", async () => {
    t = await createTestApp();
    const res = await t.api.post("/api/groups", { name: "X", members: ["fantasma"] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fantasma/);
  });
});
