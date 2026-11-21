import { Global, Module } from "@nestjs/common";
import { PacksService } from "./packs.service.js";

@Global()
@Module({ providers: [PacksService], exports: [PacksService] })
export class PacksModule {}
