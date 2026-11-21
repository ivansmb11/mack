import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? `file:${join(homedir(), ".mack", "mack.db")}` },
});
