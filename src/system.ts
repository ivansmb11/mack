import { join } from "node:path";
import { loadConfig, PROJECT_ROOT, type MackConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { createFactory, loadTemplates } from "./factory.ts";
import { cliHermes, fakeHermes, type Hermes } from "./hermes.ts";
import { createLedger } from "./ledger.ts";
import { createMatrix } from "./matrix.ts";
import { loadPacks, vendorPack } from "./packs.ts";

export function createSystem(opts: { config?: MackConfig; hermes?: Hermes; dryRun?: boolean } = {}) {
  const config = opts.config ?? loadConfig();
  const hermes = opts.hermes ?? (opts.dryRun ? fakeHermes(join(config.dataDir, "dry-run-hermes")) : cliHermes(config.hermes.bin, config.hermes.home));
  const db = openDb(join(config.dataDir, "mack.db"));
  const ledger = createLedger(db, config.pricing);
  const packsHome = join(config.dataDir, "packs");
  const factory = createFactory({
    db,
    hermes,
    config,
    ledger,
    packs: loadPacks(join(PROJECT_ROOT, "packs")),
    vendorPack: (pack) => vendorPack(packsHome, pack),
  });
  const matrix = createMatrix({ factory, ledger });
  const templates = loadTemplates(join(PROJECT_ROOT, "templates"));
  return { config, db, hermes, ledger, factory, matrix, templates };
}

export type System = ReturnType<typeof createSystem>;
