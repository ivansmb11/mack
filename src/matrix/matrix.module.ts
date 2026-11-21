import { Module } from "@nestjs/common";
import { DsaModule } from "../dsa/dsa.module.js";
import { MatrixController } from "./matrix.controller.js";
import { MatrixService } from "./matrix.service.js";

@Module({ imports: [DsaModule], controllers: [MatrixController], providers: [MatrixService] })
export class MatrixModule {}
