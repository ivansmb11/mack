import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Controller, Get, Header, Inject } from "@nestjs/common";
import { Public } from "../auth/token.guard.js";
import { type MackConfig, MACK_CONFIG, PROJECT_ROOT } from "../config/config.js";

@Controller()
export class WebController {
  constructor(@Inject(MACK_CONFIG) private readonly config: MackConfig) {}

  @Public()
  @Get("healthz")
  health() {
    return { ok: true, domain: this.config.domain };
  }

  /** The dashboard is public HTML; it asks for MACK_TOKEN and sends it on every API call. */
  @Public()
  @Get()
  @Header("content-type", "text/html; charset=utf-8")
  dashboard() {
    return readFileSync(join(PROJECT_ROOT, "web/index.html"), "utf8");
  }
}
