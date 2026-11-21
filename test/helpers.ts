import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MackConfig } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { createFactory } from "../src/factory.ts";
import { fakeHermes } from "../src/hermes.ts";
import { createLedger } from "../src/ledger.ts";
import type { SkillPack } from "../src/packs.ts";

export function testSystem(pricing: MackConfig["pricing"] = {}) {
  const root = mkdtempSync(join(tmpdir(), "mack-test-"));
  const config: MackConfig = {
    domain: "mack.test",
    server: { host: "127.0.0.1", port: 7777 },
    hermes: {
      bin: "hermes",
      home: join(root, "hermes"),
      orchestrator: "mack",
      orchestratorPort: 8642,
      dsaPortRange: [8650, 8652],
      inheritEnv: ["ANTHROPIC_API_KEY"],
    },
    dataDir: root,
    pricing,
  };
  const db = openDb(":memory:");
  const hermes = fakeHermes(config.hermes.home);
  const ledger = createLedger(db, pricing);
  const pack: SkillPack = { name: "demo", description: "demo pack", repo: "x", commit: "abcdef1", skills: ["skills/a"] };
  const vendored: string[] = [];
  const factory = createFactory({
    db,
    hermes,
    config,
    ledger,
    packs: new Map([[pack.name, pack]]),
    vendorPack: async (p) => (vendored.push(p.name), join(root, "packs", p.name)),
  });
  return { root, config, db, hermes, ledger, factory, vendored };
}

export const dsaSpec = (overrides: Record<string, unknown> = {}) => ({
  name: "finanzas",
  description: "Finanzas personales en México",
  domains: ["gastos", "factura", "sat", "estado de cuenta"],
  model: { provider: "anthropic", default: "claude-sonnet-5-5" },
  packs: ["demo"],
  soul: "# Finanzas\nEres el DSA de finanzas.",
  ...overrides,
});
