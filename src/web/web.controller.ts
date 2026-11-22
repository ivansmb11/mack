import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Controller, Get, Header, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../auth/token.guard.js";
import { type MackConfig, MACK_CONFIG, PROJECT_ROOT } from "../config/config.js";

export const WEB_DIST = join(PROJECT_ROOT, "web/dist");

@Controller()
export class WebController {
  constructor(@Inject(MACK_CONFIG) private readonly config: MackConfig) {}

  @Public()
  @Get("healthz")
  health() {
    return { ok: true, domain: this.config.domain };
  }

  /** The dashboard shell is public; it asks for MACK_TOKEN and sends it on every API call. */
  @Public()
  @Get()
  @Header("content-type", "text/html; charset=utf-8")
  dashboard() {
    const index = join(WEB_DIST, "index.html");
    if (!existsSync(index)) throw new ServiceUnavailableException("Dashboard not built: run `npm run build`");
    return readFileSync(index, "utf8");
  }
}
