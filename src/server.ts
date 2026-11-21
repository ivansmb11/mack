import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { requireEnv } from "./config.ts";
import { createSystem } from "./system.ts";

const system = createSystem();
const app = createApp({ ...system, token: requireEnv("MACK_TOKEN") });
const { host, port } = system.config.server;

serve({ fetch: app.fetch, hostname: host, port }, () => {
  console.log(`mack control plane on http://${host}:${port} → https://${system.config.domain}`);
});
