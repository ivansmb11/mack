import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { MACK_TOKEN, TokenGuard } from "./auth/token.guard.js";
import { requireEnv } from "./config/config.js";
import { ConfigModule } from "./config/config.module.js";
import { BotsModule } from "./bots/bots.module.js";
import { DsaModule } from "./dsa/dsa.module.js";
import { FactoryModule } from "./factory/factory.module.js";
import { HermesModule } from "./hermes/hermes.module.js";
import { LedgerModule } from "./ledger/ledger.module.js";
import { FetchModule } from "./matrix/fetch.js";
import { MatrixModule } from "./matrix/matrix.module.js";
import { OpenAiModule } from "./openai/openai.module.js";
import { PacksModule } from "./packs/packs.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { WebController } from "./web/web.controller.js";
import { ZodErrorFilter } from "./zod-error.filter.js";

@Global()
@Module({
  providers: [{ provide: MACK_TOKEN, useFactory: () => requireEnv("MACK_TOKEN") }],
  exports: [MACK_TOKEN],
})
class AuthModule {}

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    PrismaModule,
    HermesModule,
    PacksModule,
    FetchModule,
    LedgerModule,
    DsaModule,
    BotsModule,
    MatrixModule,
    FactoryModule,
    OpenAiModule,
  ],
  controllers: [WebController],
  providers: [
    { provide: APP_GUARD, useClass: TokenGuard },
    { provide: APP_FILTER, useClass: ZodErrorFilter },
  ],
})
export class AppModule {}
