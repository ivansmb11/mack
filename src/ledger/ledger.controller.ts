import { Body, Controller, Delete, Get, HttpCode, Param, Put } from "@nestjs/common";
import { type BudgetInput, BudgetSchema, type SubscriptionInput, SubscriptionSchema } from "./ledger.schemas.js";
import { LedgerService } from "./ledger.service.js";

@Controller("api/ledger")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get("summary")
  summary() {
    return this.ledger.summary();
  }

  @Get("subscriptions")
  subscriptions() {
    return this.ledger.listSubscriptions();
  }

  @Put("subscriptions")
  upsertSubscription(@Body({ schema: SubscriptionSchema }) subscription: SubscriptionInput) {
    return this.ledger.upsertSubscription(subscription);
  }

  @Delete("subscriptions/:id")
  @HttpCode(204)
  removeSubscription(@Param("id") id: string) {
    return this.ledger.removeSubscription(id);
  }

  @Get("budgets")
  budgets() {
    return this.ledger.budgets();
  }

  @Put("budgets/:agent")
  async setBudget(@Param("agent") agent: string, @Body({ schema: BudgetSchema }) budget: BudgetInput) {
    await this.ledger.setBudget(agent, budget);
    return budget;
  }
}
