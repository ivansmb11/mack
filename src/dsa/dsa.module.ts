import { Module } from "@nestjs/common";
import { DsaController } from "./dsa.controller.js";
import { DsaService } from "./dsa.service.js";

@Module({ controllers: [DsaController], providers: [DsaService], exports: [DsaService] })
export class DsaModule {}
