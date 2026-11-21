import { join } from "node:path";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { type MackConfig, MACK_CONFIG, PROJECT_ROOT } from "../config/config.js";
import { loadPacks, type SkillPack, vendorPack } from "./packs.js";

@Injectable()
export class PacksService {
  readonly packs: Map<string, SkillPack> = loadPacks(join(PROJECT_ROOT, "packs"));
  private readonly home: string;

  constructor(@Inject(MACK_CONFIG) config: MackConfig) {
    this.home = join(config.dataDir, "packs");
  }

  resolve(names: string[]): SkillPack[] {
    return names.map((name) => {
      const pack = this.packs.get(name);
      if (!pack) throw new BadRequestException(`Unknown skill pack "${name}". Available: ${[...this.packs.keys()].join(", ")}`);
      return pack;
    });
  }

  /** Returns the local directory Hermes or a sandbox can mount, vendoring it first if needed. */
  vendor(pack: SkillPack): Promise<string> {
    return vendorPack(this.home, pack);
  }
}
