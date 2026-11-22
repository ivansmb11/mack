import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import type { z } from "zod";
import { type GroupInput, GroupMessageSchema, GroupPatchSchema, GroupSchema } from "./bots.schemas.js";
import { GroupsService } from "./groups.service.js";

@Controller("api/groups")
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list() {
    return this.groups.list();
  }

  @Post()
  create(@Body({ schema: GroupSchema }) input: GroupInput) {
    return this.groups.create(input);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body({ schema: GroupPatchSchema }) patch: Partial<GroupInput>) {
    return this.groups.update(id, patch);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.groups.remove(id);
  }

  @Get(":id/messages")
  async messages(@Param("id") id: string) {
    await this.groups.require(id);
    return this.groups.messages(id);
  }

  @Post(":id/messages")
  post(@Param("id") id: string, @Body({ schema: GroupMessageSchema }) { content }: z.output<typeof GroupMessageSchema>, @Res() res: Response) {
    return this.groups.post(id, content, res);
  }
}
