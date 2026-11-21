import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post } from "@nestjs/common";
import { parse } from "yaml";
import { DsaService } from "./dsa.service.js";

@Controller("api")
export class DsaController {
  constructor(private readonly dsas: DsaService) {}

  @Get("agents")
  list() {
    return this.dsas.list();
  }

  /** Accepts the spec as JSON or as raw YAML (Content-Type: application/yaml). */
  @Post("agents")
  create(@Body() body: unknown) {
    return this.dsas.create(typeof body === "string" ? parse(body) : body);
  }

  @Delete("agents/:name")
  @HttpCode(204)
  remove(@Param("name") name: string) {
    return this.dsas.remove(name);
  }

  @Post("agents/:name/start")
  @HttpCode(204)
  start(@Param("name") name: string) {
    return this.dsas.start(name);
  }

  @Post("agents/:name/stop")
  @HttpCode(204)
  stop(@Param("name") name: string) {
    return this.dsas.stop(name);
  }

  @Post("orchestrator/init")
  initOrchestrator(@Body() body: { start?: boolean } = {}) {
    return this.dsas.initOrchestrator({ start: body.start });
  }

  @Get("templates")
  templates() {
    return [...this.dsas.templates.values()];
  }

  @Post("templates/:template/instantiate")
  instantiate(@Param("template") name: string, @Body() overrides: Record<string, unknown> = {}) {
    const template = this.dsas.templates.get(name);
    if (!template) throw new NotFoundException(`Template "${name}" not found`);
    return this.dsas.create({ ...template, ...overrides });
  }
}
