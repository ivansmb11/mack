import { Module } from "@nestjs/common";
import { DsaModule } from "../dsa/dsa.module.js";
import { OpenAiProxyController } from "./openai-proxy.controller.js";

@Module({ imports: [DsaModule], controllers: [OpenAiProxyController] })
export class OpenAiModule {}
