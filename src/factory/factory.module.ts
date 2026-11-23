import { Module } from "@nestjs/common";
import { AGENT_RUNNER } from "./agent-runner.js";
import { FactoryController } from "./factory.controller.js";
import { FactoryService } from "./factory.service.js";
import { sandboxSecrets, sandcastleRunner } from "./sandcastle.runner.js";

@Module({
  controllers: [FactoryController],
  providers: [FactoryService, { provide: AGENT_RUNNER, useFactory: () => sandcastleRunner(sandboxSecrets(process.env)) }],
})
export class FactoryModule {}
