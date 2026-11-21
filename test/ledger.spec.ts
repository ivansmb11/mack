import { afterEach, describe, expect, it } from "vitest";
import { LedgerService } from "../src/ledger/ledger.service.js";
import { createTestApp, dsaSpec } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

describe("Ledger", () => {
  it("summarizes metered spend, unpriced tokens and subscriptions", async () => {
    t = await createTestApp({ pricing: { priced: { inputPerMTok: 3, outputPerMTok: 15 } } });
    const ledger = t.get<LedgerService>(LedgerService);
    await ledger.record("dev", "priced", { prompt_tokens: 1_000_000, completion_tokens: 100_000 }, "matrix");
    await ledger.record("dev", "mystery", { prompt_tokens: 10, completion_tokens: 5 }, "matrix");
    const sub = { id: "claude-max", provider: "anthropic", plan: "Max", monthlyUsd: 200, renewsOn: "2026-12-01" };
    expect((await t.api.put("/api/ledger/subscriptions", sub)).status).toBe(200);
    await t.api.put("/api/ledger/subscriptions", { ...sub, plan: "Max 20x" });

    const s = (await t.api.get("/api/ledger/summary")).body;
    expect(s).toMatchObject({ meteredUsd: 4.5, unpricedTokens: 15, subscriptionsUsd: 200, totalUsd: 204.5 });
    expect(s.subscriptions).toHaveLength(1);
    expect(s.subscriptions[0].plan).toBe("Max 20x");
    expect(s.perAgent).toEqual([{ agent: "dev", tokens: 1_100_015, usd: 4.5, calls: 2, budget: null }]);
  });

  it("USD budgets ignore unpriced usage; token budgets count it", async () => {
    t = await createTestApp();
    await t.api.post("/api/agents", dsaSpec({ name: "a1" }));
    await t.api.post("/api/agents", dsaSpec({ name: "b1" }));
    await t.api.put("/api/ledger/budgets/a1", { monthlyUsd: 1 });
    await t.api.put("/api/ledger/budgets/b1", { monthlyTokens: 10 });
    const ledger = t.get<LedgerService>(LedgerService);
    for (const agent of ["a1", "b1"]) await ledger.record(agent, "free", { prompt_tokens: 10, completion_tokens: 0 }, "t");

    await expect(ledger.assertWithinBudget("a1")).resolves.toBeUndefined();
    await expect(ledger.assertWithinBudget("b1")).rejects.toThrow(/10 \/ 10 tokens/);
    await expect(ledger.assertWithinBudget("nobody")).resolves.toBeUndefined();
  });

  it("validates input and 404s budgets for unknown agents", async () => {
    t = await createTestApp();
    expect((await t.api.put("/api/ledger/subscriptions", { id: "Bad Id" })).status).toBe(400);
    expect((await t.api.put("/api/ledger/budgets/ghost", { monthlyTokens: 5 })).status).toBe(404);
  });
});
