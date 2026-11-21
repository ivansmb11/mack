import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type MackConfig, MACK_CONFIG } from "../config/config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { BudgetExceededError } from "./budget-exceeded.error.js";
import type { BudgetInput, SubscriptionInput, Usage } from "./ledger.schemas.js";

export interface Spend {
  tokens: number;
  usd: number;
  unpricedTokens: number;
}

const startOfMonth = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), 1);

/** Token/cost accounting per agent, budgets enforced before dispatch, and flat-fee subscriptions. */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MACK_CONFIG) private readonly config: MackConfig,
  ) {}

  private costOf(model: string, usage: Usage): number | null {
    const price = this.config.pricing[model];
    if (!price) return null;
    return (usage.prompt_tokens * price.inputPerMTok + usage.completion_tokens * price.outputPerMTok) / 1_000_000;
  }

  async record(agent: string, model: string, usage: Usage, source: string): Promise<void> {
    await this.prisma.usage.create({
      data: {
        agent,
        model,
        source,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        costUsd: this.costOf(model, usage),
      },
    });
  }

  async monthSpend(agent?: string): Promise<Spend> {
    const where = { at: { gte: startOfMonth() }, ...(agent ? { agent } : {}) };
    const sum = { promptTokens: true, completionTokens: true, costUsd: true } as const;
    const [all, unpriced] = await Promise.all([
      this.prisma.usage.aggregate({ where, _sum: sum }),
      this.prisma.usage.aggregate({ where: { ...where, costUsd: null }, _sum: sum }),
    ]);
    const tokens = (s: typeof all._sum) => (s.promptTokens ?? 0) + (s.completionTokens ?? 0);
    return { tokens: tokens(all._sum), usd: all._sum.costUsd ?? 0, unpricedTokens: tokens(unpriced._sum) };
  }

  async setBudget(agent: string, budget: BudgetInput): Promise<void> {
    if (!(await this.prisma.agent.findUnique({ where: { name: agent } }))) throw new NotFoundException(`Agent "${agent}" not found`);
    await this.prisma.budget.upsert({ where: { agentName: agent }, create: { agentName: agent, ...budget }, update: budget });
  }

  getBudget(agent: string) {
    return this.prisma.budget.findUnique({ where: { agentName: agent }, select: { monthlyTokens: true, monthlyUsd: true } });
  }

  async assertWithinBudget(agent: string): Promise<void> {
    const budget = await this.getBudget(agent);
    if (!budget) return;
    const spend = await this.monthSpend(agent);
    if (budget.monthlyTokens !== null && spend.tokens >= budget.monthlyTokens)
      throw new BudgetExceededError(agent, `${spend.tokens} / ${budget.monthlyTokens} tokens this month`);
    if (budget.monthlyUsd !== null && spend.usd >= budget.monthlyUsd)
      throw new BudgetExceededError(agent, `$${spend.usd.toFixed(2)} / $${budget.monthlyUsd} this month`);
  }

  async upsertSubscription({ id, ...data }: SubscriptionInput) {
    return this.prisma.subscription.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  async removeSubscription(id: string): Promise<void> {
    await this.prisma.subscription.deleteMany({ where: { id } });
  }

  listSubscriptions() {
    return this.prisma.subscription.findMany({ orderBy: { renewsOn: "asc" } });
  }

  async summary() {
    const [grouped, subscriptions, metered] = await Promise.all([
      this.prisma.usage.groupBy({
        by: ["agent"],
        where: { at: { gte: startOfMonth() } },
        _sum: { promptTokens: true, completionTokens: true, costUsd: true },
        _count: { _all: true },
      }),
      this.listSubscriptions(),
      this.monthSpend(),
    ]);
    const perAgent = await Promise.all(
      grouped.map(async (g) => ({
        agent: g.agent,
        tokens: (g._sum.promptTokens ?? 0) + (g._sum.completionTokens ?? 0),
        usd: g._sum.costUsd ?? 0,
        calls: g._count._all,
        budget: await this.getBudget(g.agent),
      })),
    );
    const subscriptionsUsd = subscriptions.reduce((sum, s) => sum + s.monthlyUsd, 0);
    return {
      month: new Date().toISOString().slice(0, 7),
      meteredUsd: metered.usd,
      unpricedTokens: metered.unpricedTokens,
      subscriptionsUsd,
      totalUsd: metered.usd + subscriptionsUsd,
      perAgent: perAgent.sort((a, b) => b.tokens - a.tokens),
      subscriptions,
    };
  }
}
