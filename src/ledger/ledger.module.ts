import { Global, Module } from "@nestjs/common";
import { LedgerController } from "./ledger.controller.js";
import { LedgerService } from "./ledger.service.js";

@Global()
@Module({ controllers: [LedgerController], providers: [LedgerService], exports: [LedgerService] })
export class LedgerModule {}
