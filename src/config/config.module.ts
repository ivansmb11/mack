import { Global, Module } from "@nestjs/common";
import { loadConfig, MACK_CONFIG } from "./config.js";

@Global()
@Module({
  providers: [{ provide: MACK_CONFIG, useFactory: () => loadConfig() }],
  exports: [MACK_CONFIG],
})
export class ConfigModule {}
