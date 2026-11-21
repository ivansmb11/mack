import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../src/db.ts";
import { createLedger } from "../src/ledger.ts";

test("summarizes metered spend, unpriced tokens and subscriptions", () => {
  const ledger = createLedger(openDb(":memory:"), { priced: { inputPerMTok: 3, outputPerMTok: 15 } });
  ledger.record("dev", "priced", { prompt_tokens: 1_000_000, completion_tokens: 100_000 }, "matrix");
  ledger.record("dev", "mystery", { prompt_tokens: 10, completion_tokens: 5 }, "matrix");
  ledger.upsertSubscription({ id: "claude-max", provider: "anthropic", plan: "Max", monthlyUsd: 200, renewsOn: "2026-12-01", monthlyTokenQuota: null, notes: null });
  ledger.upsertSubscription({ id: "claude-max", provider: "anthropic", plan: "Max 20x", monthlyUsd: 200, renewsOn: "2026-12-01", monthlyTokenQuota: null, notes: null });

  const s = ledger.summary();
  assert.equal(s.meteredUsd, 4.5);
  assert.equal(s.unpricedTokens, 15);
  assert.equal(s.subscriptionsUsd, 200);
  assert.equal(s.totalUsd, 204.5);
  assert.equal(s.subscriptions.length, 1);
  assert.equal(s.subscriptions[0].plan, "Max 20x");
  assert.deepEqual(s.perAgent.map((a) => [a.agent, a.tokens, a.calls]), [["dev", 1_100_015, 2]]);
});

test("USD budgets ignore unpriced usage; token budgets count it", () => {
  const ledger = createLedger(openDb(":memory:"), {});
  ledger.setBudget("a", { monthlyTokens: null, monthlyUsd: 1 });
  ledger.setBudget("b", { monthlyTokens: 10, monthlyUsd: null });
  for (const agent of ["a", "b"]) ledger.record(agent, "free", { prompt_tokens: 10, completion_tokens: 0 }, "t");
  assert.doesNotThrow(() => ledger.assertWithinBudget("a"));
  assert.throws(() => ledger.assertWithinBudget("b"), /10 \/ 10 tokens/);
  assert.doesNotThrow(() => ledger.assertWithinBudget("no-budget"));
});
