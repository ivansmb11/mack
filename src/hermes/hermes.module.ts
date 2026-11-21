import { join } from "node:path";
import { Global, Module } from "@nestjs/common";
import { type MackConfig, MACK_CONFIG } from "../config/config.js";
import { cliHermes, fakeHermes, HERMES } from "./hermes.js";

/** MACK_DRY_RUN=1 swaps the Hermes CLI for an in-process fake that only lays out profile dirs. */
@Global()
@Module({
  providers: [
    {
      provide: HERMES,
      inject: [MACK_CONFIG],
      useFactory: (config: MackConfig) =>
        process.env.MACK_DRY_RUN === "1"
          ? fakeHermes(join(config.dataDir, "dry-run-hermes"))
          : cliHermes(config.hermes.bin, config.hermes.home),
    },
  ],
  exports: [HERMES],
})
export class HermesModule {}
