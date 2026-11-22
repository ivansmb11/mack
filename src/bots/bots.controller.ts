import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { DsaService } from "../dsa/dsa.service.js";
import { type AgentPatch, AgentPatchSchema } from "../dsa/dsa.schemas.js";
import { ApprovalSchema, ChatSchema, RoutinePatchSchema, RoutineSchema, type RoutineInput } from "./bots.schemas.js";
import { BotsService } from "./bots.service.js";
import type { z } from "zod";

const ROUTINE_ACTIONS = ["pause", "resume", "run"] as const;
type RoutineAction = (typeof ROUTINE_ACTIONS)[number];

@Controller("api/bots")
export class BotsController {
  constructor(
    private readonly bots: BotsService,
    private readonly dsas: DsaService,
  ) {}

  @Get()
  list() {
    return this.bots.list();
  }

  @Get(":name")
  profile(@Param("name") name: string) {
    return this.bots.profile(name);
  }

  @Patch(":name")
  update(@Param("name") name: string, @Body({ schema: AgentPatchSchema }) patch: AgentPatch) {
    return this.dsas.update(name, patch);
  }

  /** Files sent in the chat; the browser fetches them with the bearer token, so plain <img src> can't be used. */
  @Get(":name/attachments")
  async attachment(@Param("name") name: string, @Query("path") path: string, @Res() res: Response) {
    res.sendFile(await this.bots.attachment(name, path ?? ""), { dotfiles: "allow" });
  }

  @Get(":name/messages")
  messages(@Param("name") name: string) {
    return this.bots.messages(name);
  }

  @Post(":name/chat")
  chat(@Param("name") name: string, @Body({ schema: ChatSchema }) { message, attachments }: z.output<typeof ChatSchema>, @Res() res: Response) {
    return this.bots.chat(name, message, attachments, res);
  }

  @Post(":name/runs/:runId/approval")
  @HttpCode(204)
  approve(@Param("name") name: string, @Param("runId") runId: string, @Body({ schema: ApprovalSchema }) body: z.output<typeof ApprovalSchema>) {
    return this.bots.approve(name, runId, body.choice, body.requestId);
  }

  @Post(":name/runs/:runId/stop")
  @HttpCode(204)
  stop(@Param("name") name: string, @Param("runId") runId: string) {
    return this.bots.stopRun(name, runId);
  }

  @Get(":name/routines")
  routines(@Param("name") name: string) {
    return this.bots.routines(name);
  }

  @Post(":name/routines")
  createRoutine(@Param("name") name: string, @Body({ schema: RoutineSchema }) input: RoutineInput) {
    return this.bots.createRoutine(name, input);
  }

  @Patch(":name/routines/:id")
  updateRoutine(@Param("name") name: string, @Param("id") id: string, @Body({ schema: RoutinePatchSchema }) patch: Partial<RoutineInput>) {
    return this.bots.updateRoutine(name, id, patch);
  }

  @Delete(":name/routines/:id")
  @HttpCode(204)
  removeRoutine(@Param("name") name: string, @Param("id") id: string) {
    return this.bots.removeRoutine(name, id);
  }

  @Post(":name/routines/:id/:action")
  @HttpCode(204)
  routineAction(@Param("name") name: string, @Param("id") id: string, @Param("action") action: string) {
    if (!ROUTINE_ACTIONS.includes(action as RoutineAction)) throw new NotFoundException();
    return this.bots.routineAction(name, id, action as RoutineAction);
  }

  @Get(":name/routines/:id/runs")
  routineRuns(@Param("name") name: string, @Param("id") id: string) {
    return this.bots.routineRuns(name, id);
  }
}
