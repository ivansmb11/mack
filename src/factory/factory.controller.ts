import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { type JobSpec, JobSpecSchema } from "./factory.schemas.js";
import { FactoryService } from "./factory.service.js";

@Controller("api/factory/jobs")
export class FactoryController {
  constructor(private readonly factory: FactoryService) {}

  @Post()
  submit(@Body({ schema: JobSpecSchema }) spec: JobSpec) {
    return this.factory.submit(spec);
  }

  @Get()
  list(@Query("limit") limit?: string) {
    return this.factory.list(limit ? Math.min(Number(limit), 200) : undefined);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.factory.get(id);
  }
}
