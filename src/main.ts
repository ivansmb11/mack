import "reflect-metadata";
import { type INestApplication, StandardSchemaValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config/config.js";
import { WEB_DIST } from "./web/web.controller.js";

/** Shared by main and the e2e tests so both run the exact same HTTP pipeline. */
export function configureApp(app: NestExpressApplication): INestApplication {
  app.useBodyParser("text", { type: "application/yaml" });
  app.useStaticAssets(WEB_DIST, { index: false, maxAge: "1y", immutable: true });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();
  return app;
}

if (import.meta.main) {
  const { server, domain } = loadConfig();
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule));
  await app.listen(server.port, server.host);
  console.log(`mack control plane on http://${server.host}:${server.port} → https://${domain}`);
}
