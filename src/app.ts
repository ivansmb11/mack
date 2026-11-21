import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono, type MiddlewareHandler } from "hono";
import { parse } from "yaml";
import { z } from "zod";
import { PROJECT_ROOT, type MackConfig } from "./config.ts";
import type { AgentSpec, Factory } from "./factory.ts";
import { BudgetExceeded, type Ledger, type Usage } from "./ledger.ts";
import type { Matrix } from "./matrix.ts";

const DispatchSchema = z.object({ task: z.string().min(1), agent: z.string().optional(), context: z.string().optional() });

const SubscriptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  provider: z.string(),
  plan: z.string(),
  monthlyUsd: z.number().nonnegative(),
  renewsOn: z.string().date().nullable().default(null),
  monthlyTokenQuota: z.number().int().positive().nullable().default(null),
  notes: z.string().nullable().default(null),
});

const BudgetSchema = z.object({
  monthlyTokens: z.number().int().positive().nullable().default(null),
  monthlyUsd: z.number().positive().nullable().default(null),
});

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export interface AppDeps {
  config: MackConfig;
  token: string;
  factory: Factory;
  matrix: Matrix;
  ledger: Ledger;
  templates: Map<string, AgentSpec>;
  fetch?: typeof fetch;
}

export function createApp({ config, token, factory, matrix, ledger, templates, fetch: doFetch = fetch }: AppDeps) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof BudgetExceeded) return c.json({ error: err.message }, 402);
    if (err instanceof z.ZodError) return c.json({ error: "invalid_input", issues: err.issues }, 400);
    return c.json({ error: err.message }, 500);
  });

  app.get("/healthz", (c) => c.json({ ok: true, domain: config.domain }));
  app.get("/", (c) => c.html(readFileSync(join(PROJECT_ROOT, "web/index.html"), "utf8")));

  const requireToken: MiddlewareHandler = async (c, next) => {
    const provided = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!safeEqual(provided, token)) return c.json({ error: { message: "unauthorized" } }, 401);
    await next();
  };
  app.use("/api/*", requireToken);
  app.use("/v1/*", requireToken);

  app.get("/api/agents", (c) => c.json(factory.list()));
  app.get("/api/agents/health", async (c) => c.json(await matrix.health()));
  app.post("/api/agents", async (c) => {
    const raw = c.req.header("content-type")?.includes("yaml") ? parse(await c.req.text()) : await c.req.json();
    return c.json(await factory.create(raw), 201);
  });
  app.delete("/api/agents/:name", async (c) => {
    await factory.remove(c.req.param("name"));
    return c.body(null, 204);
  });
  app.post("/api/agents/:name/start", async (c) => (await factory.start(c.req.param("name")), c.json({ ok: true })));
  app.post("/api/agents/:name/stop", async (c) => (await factory.stop(c.req.param("name")), c.json({ ok: true })));

  app.get("/api/templates", (c) => c.json([...templates.values()]));
  app.post("/api/templates/:template/instantiate", async (c) => {
    const template = templates.get(c.req.param("template"));
    if (!template) return c.json({ error: "template_not_found" }, 404);
    const overrides = await c.req.json().catch(() => ({}));
    return c.json(await factory.create({ ...template, ...overrides }), 201);
  });

  app.post("/api/matrix/route", async (c) => c.json(matrix.route(DispatchSchema.parse(await c.req.json()).task)));
  app.post("/api/matrix/dispatch", async (c) => c.json(await matrix.dispatch(DispatchSchema.parse(await c.req.json()))));
  app.post("/api/matrix/fanout", async (c) =>
    c.json(await matrix.fanout(z.array(DispatchSchema).min(1).parse(await c.req.json()))),
  );

  app.get("/api/ledger/summary", (c) => c.json(ledger.summary()));
  app.get("/api/ledger/subscriptions", (c) => c.json(ledger.listSubscriptions()));
  app.put("/api/ledger/subscriptions", async (c) => {
    const subscription = SubscriptionSchema.parse(await c.req.json());
    ledger.upsertSubscription(subscription);
    return c.json(subscription);
  });
  app.delete("/api/ledger/subscriptions/:id", (c) => (ledger.removeSubscription(c.req.param("id")), c.body(null, 204)));
  app.put("/api/ledger/budgets/:agent", async (c) => {
    const budget = BudgetSchema.parse(await c.req.json());
    ledger.setBudget(c.req.param("agent"), budget);
    return c.json(budget);
  });

  // OpenAI-compatible front door to Mack so any chat client (Open WebUI, mobile apps) can talk to it
  // with MACK_TOKEN; the orchestrator's own API_SERVER_KEY never leaves the Mac mini.
  app.all("/v1/*", async (c) => {
    const orchestrator = config.hermes.orchestrator;
    ledger.assertWithinBudget(orchestrator);
    const upstream = await doFetch(`http://127.0.0.1:${config.hermes.orchestratorPort}${c.req.path}`, {
      method: c.req.method,
      headers: { "content-type": c.req.header("content-type") ?? "application/json", authorization: `Bearer ${factory.apiKey(orchestrator)}` },
      body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.text(),
    });
    const isJson = upstream.headers.get("content-type")?.includes("application/json");
    if (!isJson) return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });

    const body = (await upstream.json()) as { usage?: Usage; model?: string };
    if (body.usage) ledger.record(orchestrator, factory.get(orchestrator)?.model ?? body.model ?? "unknown", body.usage, "api");
    return c.json(body, upstream.status as 200);
  });

  return app;
}
