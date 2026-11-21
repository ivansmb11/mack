import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { type MackConfig, MACK_CONFIG } from "../config/config.js";
import { PrismaClient } from "../generated/prisma/client.js";

export const databaseUrl = (config: MackConfig) => process.env.DATABASE_URL ?? `file:${join(config.dataDir, "mack.db")}`;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(MACK_CONFIG) config: MackConfig) {
    mkdirSync(config.dataDir, { recursive: true });
    super({ adapter: new PrismaBetterSqlite3({ url: databaseUrl(config) }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
