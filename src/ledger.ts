import type { Price } from "./config.ts";
import type { Db } from "./db.ts";

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface Budget {
  monthlyTokens: number | null;
  monthlyUsd: number | null;
}

export interface Subscription {
  id: string;
  provider: string;
  plan: string;
  monthlyUsd: number;
  renewsOn: string | null;
  monthlyTokenQuota: number | null;
  notes: string | null;
}

export interface Spend {
  tokens: number;
  usd: number;
  unpricedTokens: number;
}

export class BudgetExceeded extends Error {
  readonly agent: string;
  constructor(agent: string, reason: string) {
    super(`Budget exceeded for ${agent}: ${reason}`);
    this.agent = agent;
  }
}

const MONTH_START = "date('now', 'start of month')";

/** Token/cost accounting per agent, budgets enforced before dispatch, and flat-fee subscriptions. */
export function createLedger(db: Db, pricing: Record<string, Price>) {
  const costOf = (model: string, usage: Usage): number | null => {
    const price = pricing[model];
    if (!price) return null;
    return (usage.prompt_tokens * price.inputPerMTok + usage.completion_tokens * price.outputPerMTok) / 1_000_000;
  };

  const monthSpend = (agent?: string): Spend => {
    const row = db
      .prepare(
        `select coalesce(sum(prompt_tokens + completion_tokens), 0) as tokens,
                coalesce(sum(cost_usd), 0) as usd,
                coalesce(sum(case when cost_usd is null then prompt_tokens + completion_tokens end), 0) as unpriced
           from usage where at >= ${MONTH_START} and (? is null or agent = ?)`,
      )
      .get(agent ?? null, agent ?? null) as { tokens: number; usd: number; unpriced: number };
    return { tokens: row.tokens, usd: row.usd, unpricedTokens: row.unpriced };
  };

  const getBudget = (agent: string): Budget | null => {
    const row = db.prepare("select monthly_tokens, monthly_usd from budgets where agent = ?").get(agent) as
      | { monthly_tokens: number | null; monthly_usd: number | null }
      | undefined;
    return row ? { monthlyTokens: row.monthly_tokens, monthlyUsd: row.monthly_usd } : null;
  };

  const listSubscriptions = (): Subscription[] =>
    (db.prepare("select * from subscriptions order by renews_on").all() as Record<string, never>[]).map((r) => ({
      id: r.id,
      provider: r.provider,
      plan: r.plan,
      monthlyUsd: r.monthly_usd,
      renewsOn: r.renews_on,
      monthlyTokenQuota: r.monthly_token_quota,
      notes: r.notes,
    }));

  return {
    record(agent: string, model: string, usage: Usage, source: string) {
      db.prepare(
        "insert into usage (agent, model, prompt_tokens, completion_tokens, cost_usd, source) values (?, ?, ?, ?, ?, ?)",
      ).run(agent, model, usage.prompt_tokens, usage.completion_tokens, costOf(model, usage), source);
    },

    monthSpend,

    setBudget(agent: string, budget: Budget) {
      db.prepare(
        `insert into budgets (agent, monthly_tokens, monthly_usd) values (?, ?, ?)
         on conflict (agent) do update set monthly_tokens = excluded.monthly_tokens, monthly_usd = excluded.monthly_usd`,
      ).run(agent, budget.monthlyTokens, budget.monthlyUsd);
    },

    getBudget,

    assertWithinBudget(agent: string) {
      const budget = getBudget(agent);
      if (!budget) return;
      const spend = monthSpend(agent);
      if (budget.monthlyTokens !== null && spend.tokens >= budget.monthlyTokens)
        throw new BudgetExceeded(agent, `${spend.tokens} / ${budget.monthlyTokens} tokens this month`);
      if (budget.monthlyUsd !== null && spend.usd >= budget.monthlyUsd)
        throw new BudgetExceeded(agent, `$${spend.usd.toFixed(2)} / $${budget.monthlyUsd} this month`);
    },

    upsertSubscription(s: Subscription) {
      db.prepare(
        `insert into subscriptions (id, provider, plan, monthly_usd, renews_on, monthly_token_quota, notes)
         values (?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set provider = excluded.provider, plan = excluded.plan,
           monthly_usd = excluded.monthly_usd, renews_on = excluded.renews_on,
           monthly_token_quota = excluded.monthly_token_quota, notes = excluded.notes`,
      ).run(s.id, s.provider, s.plan, s.monthlyUsd, s.renewsOn, s.monthlyTokenQuota, s.notes);
    },

    removeSubscription(id: string) {
      db.prepare("delete from subscriptions where id = ?").run(id);
    },

    listSubscriptions,

    summary() {
      const perAgent = db
        .prepare(
          `select agent, sum(prompt_tokens + completion_tokens) as tokens, sum(cost_usd) as usd, count(*) as calls
             from usage where at >= ${MONTH_START} group by agent order by tokens desc`,
        )
        .all() as { agent: string; tokens: number; usd: number | null; calls: number }[];
      const subscriptions = listSubscriptions();
      const subscriptionsUsd = subscriptions.reduce((sum, s) => sum + s.monthlyUsd, 0);
      const metered = monthSpend();
      return {
        month: new Date().toISOString().slice(0, 7),
        meteredUsd: metered.usd,
        unpricedTokens: metered.unpricedTokens,
        subscriptionsUsd,
        totalUsd: metered.usd + subscriptionsUsd,
        perAgent: perAgent.map((a) => ({ ...a, usd: a.usd ?? 0, budget: getBudget(a.agent) })),
        subscriptions,
      };
    },
  };
}

export type Ledger = ReturnType<typeof createLedger>;
