import { HttpException, HttpStatus } from "@nestjs/common";

export class BudgetExceededError extends HttpException {
  constructor(
    readonly agent: string,
    reason: string,
  ) {
    super(`Budget exceeded for ${agent}: ${reason}`, HttpStatus.PAYMENT_REQUIRED);
  }
}
