import { Module } from "@nestjs/common";
import { DsaModule } from "../dsa/dsa.module.js";
import { BotsController } from "./bots.controller.js";
import { BotsService } from "./bots.service.js";
import { GroupsController } from "./groups.controller.js";
import { GroupsService } from "./groups.service.js";
import { HermesApi } from "./hermes-api.js";

@Module({ imports: [DsaModule], controllers: [BotsController, GroupsController], providers: [HermesApi, BotsService, GroupsService] })
export class BotsModule {}
