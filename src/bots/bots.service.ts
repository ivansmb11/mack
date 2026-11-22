import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Response } from "express";
import { type AgentRecord, DsaService } from "../dsa/dsa.service.js";
import { HERMES, type Hermes } from "../hermes/hermes.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type { RoutineInput } from "./bots.schemas.js";
import { HermesApi } from "./hermes-api.js";
import { type Attachment, type AttachmentInput, buildTurn, extractAttachments, resolveAttachment } from "./attachments.js";
import { type RoutinePost, type RoutineRun, readRoutinePosts, readRuns } from "./routine-runs.js";
import { openSse, readSse } from "./sse.js";

export type ChatMessage =
  | { id: string; role: "user" | "assistant"; content: string; toolsUsed: string[]; attachments: Attachment[]; at: string }
  | { id: string; role: "routine"; content: string; routine: RoutinePost["routine"]; failed: boolean; at: string };

export interface BotSummary extends AgentRecord {
  lastMessage: Pick<ChatMessage, "role" | "content" | "at"> | null;
}

export interface Routine {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  state: string;
  timezone: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

interface HermesMessage {
  id: number;
  role: string;
  content: string | null;
  tool_calls: { function?: { name?: string } }[] | null;
  tool_name: string | null;
  timestamp: number;
}

interface HermesJob {
  id: string;
  name: string;
  prompt: string;
  schedule_display: string;
  enabled: boolean;
  state: string;
  timezone?: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

interface HermesUsage {
  input_tokens?: number;
  output_tokens?: number;
}

const JOB_ID = /^[a-f0-9]{12}$/;

/**
 * Routine results reach the bot's memory by riding on Iván's next message, since Hermes can't append to a
 * session without running a turn. These markers let the chat hide that preamble again.
 */
const ROUTINES_OPEN = "<<rutinas>>";
const ROUTINES_CLOSE = "<</rutinas>>";
const MAX_RESULTS_IN_CONTEXT = 5;
const MAX_RESULT_CHARS = 4000;

const toIso = (seconds: number) => new Date(seconds * 1000).toISOString();

const toRoutine = (j: HermesJob): Routine => ({
  id: j.id,
  name: j.name,
  prompt: j.prompt,
  schedule: j.schedule_display,
  enabled: j.enabled,
  state: j.state,
  timezone: j.timezone ?? null,
  nextRunAt: j.next_run_at,
  lastRunAt: j.last_run_at,
  lastStatus: j.last_status,
  lastError: j.last_error,
});

/** Folds Hermes' transcript (tool calls, tool results, metadata rows) into the chat a person reads. */
export function toChat(rows: HermesMessage[], profileDir = ""): ChatMessage[] {
  const chat: ChatMessage[] = [];
  let pendingTools: string[] = [];
  for (const row of rows) {
    if (row.role === "assistant" && row.tool_calls?.length)
      pendingTools.push(...row.tool_calls.map((c) => c.function?.name ?? "herramienta"));
    if ((row.role !== "user" && row.role !== "assistant") || !row.content?.trim()) continue;
    const { content, attachments } =
      row.role === "user" ? extractAttachments(profileDir, withoutRoutineContext(row.content)) : { content: row.content, attachments: [] };
    chat.push({
      id: String(row.id),
      role: row.role,
      content,
      toolsUsed: row.role === "assistant" ? pendingTools : [],
      attachments,
      at: toIso(row.timestamp),
    });
    if (row.role === "assistant") pendingTools = [];
  }
  return chat;
}

function withoutRoutineContext(content: string): string {
  if (!content.startsWith(ROUTINES_OPEN)) return content;
  const end = content.indexOf(ROUTINES_CLOSE);
  return end < 0 ? content : content.slice(end + ROUTINES_CLOSE.length).trimStart();
}

const clip = (text: string) => (text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n[…recortado]` : text);

/** Prepends the routine results the bot hasn't seen in its thread yet, so "explícame el punto 2" makes sense to it. */
export function withRoutineContext(message: string, unseen: RoutinePost[]): string {
  const shown = unseen.filter((p) => !p.failed).slice(-MAX_RESULTS_IN_CONTEXT);
  if (!shown.length) return message;
  const results = shown.map((p) => `### ${p.routine.name} (${p.at})\n${clip(p.output)}`).join("\n\n");
  return (
    `${ROUTINES_OPEN}\nResultados de tus rutinas desde la última vez que hablaron. Iván ya los vio en el chat; ` +
    `no los repitas, úsalos como contexto.\n\n${results}\n${ROUTINES_CLOSE}\n\n${message}`
  );
}

const toPost = (p: RoutinePost): ChatMessage => ({
  id: `routine:${p.routine.id}:${p.id}`,
  role: "routine",
  content: p.output,
  routine: p.routine,
  failed: p.failed,
  at: p.at,
});

/**
 * Bots are DSAs (and Mack) presented as persistent teammates: one continuous Hermes session per bot,
 * routines as Hermes cron jobs, and approvals answered from the chat.
 */
@Injectable()
export class BotsService {
  constructor(
    private readonly dsas: DsaService,
    private readonly ledger: LedgerService,
    private readonly hermes: HermesApi,
    @Inject(HERMES) private readonly profiles: Hermes,
  ) {}

  async list(): Promise<BotSummary[]> {
    const agents = await this.dsas.list();
    return Promise.all(agents.map(async (a) => ({ ...a, lastMessage: await this.lastMessage(a).catch(() => null) })));
  }

  async profile(name: string) {
    const [agent, spec, budget, spend] = await Promise.all([
      this.dsas.require(name),
      this.dsas.spec(name),
      this.ledger.getBudget(name),
      this.ledger.monthSpend(name),
    ]);
    return { ...agent, instructions: spec.soul, packs: spec.packs, budget, spend };
  }

  private async lastMessage(agent: AgentRecord): Promise<BotSummary["lastMessage"]> {
    const thread = await this.threadTail(agent, 8).catch(() => []);
    const post = this.posts(agent.name, 1).at(-1);
    const last = [...thread, ...(post ? [post] : [])].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
    return last ? { role: last.role, content: last.content, at: last.at } : null;
  }

  private async threadTail(agent: AgentRecord, limit: number): Promise<ChatMessage[]> {
    if (!agent.threadId) return [];
    const { data } = await this.hermes.json<{ data: HermesMessage[] }>(
      agent.name,
      `/api/sessions/${agent.threadId}/messages?limit=${limit}&order=latest`,
    );
    return toChat(data, this.profiles.profileDir(agent.name));
  }

  /** Results posted after the thread's last message. Best-effort: a hiccup reading the thread mustn't block Iván's message. */
  private async unseenRoutineResults(agent: AgentRecord): Promise<RoutinePost[]> {
    try {
      const seenUntil = (await this.threadTail(agent, 4)).at(-1)?.at ?? "";
      return readRoutinePosts(this.profiles.profileDir(agent.name)).filter((p) => p.at > seenUntil);
    } catch {
      return [];
    }
  }

  private posts(name: string, perRoutine = 20): ChatMessage[] {
    return readRoutinePosts(this.profiles.profileDir(name), perRoutine).map(toPost);
  }

  /** The bot's one continuous conversation, created on first use. */
  async thread(name: string): Promise<string> {
    const agent = await this.dsas.require(name);
    if (agent.threadId) return agent.threadId;
    const id = `mack-${name}`;
    const res = await this.hermes.request(name, "/api/sessions", {
      method: "POST",
      json: { id, title: `Chat con ${name}`, source: "api_server" },
    });
    if (!res.ok && res.status !== 409) throw new BadRequestException(`Hermes no creó el chat de ${name}: ${await res.text()}`);
    await this.dsas.setThread(name, id);
    return id;
  }

  /** The thread plus every routine result, in the order they happened, so routines read as the bot posting. */
  async messages(name: string): Promise<ChatMessage[]> {
    const agent = await this.dsas.require(name);
    const [thread, posts] = [await this.threadTail(agent, 500), this.posts(name)];
    return [...thread, ...posts].sort((a, b) => a.at.localeCompare(b.at));
  }

  /**
   * Relays one turn of Hermes' session stream to the browser. The upstream is read to the end even if
   * the browser leaves, so the bot finishes its work, the turn lands in its thread and usage is metered.
   */
  async chat(name: string, message: string, attachments: AttachmentInput[], res: Response): Promise<void> {
    const agent = await this.dsas.require(name);
    await this.ledger.assertWithinBudget(name);
    const thread = await this.thread(name);
    const unseen = await this.unseenRoutineResults({ ...agent, threadId: thread });
    const upstream = await this.hermes.request(name, `/api/sessions/${thread}/chat/stream`, {
      method: "POST",
      json: {
        message: buildTurn(this.profiles.profileDir(name), withRoutineContext(message, unseen), attachments),
        author: { id: "ivan", name: "Iván" },
      },
    });
    if (!upstream.ok || !upstream.body)
      throw new BadRequestException(`${name} no aceptó el mensaje: ${await upstream.text()}`);

    openSse(res);
    for await (const { chunk, events } of readSse(upstream.body)) {
      if (!res.writableEnded && !res.destroyed) res.write(chunk);
      for (const e of events) {
        if (e.event !== "run.completed") continue;
        const usage = (JSON.parse(e.data) as { usage?: HermesUsage }).usage;
        if (usage?.input_tokens || usage?.output_tokens)
          await this.ledger.record(name, agent.model, { prompt_tokens: usage.input_tokens ?? 0, completion_tokens: usage.output_tokens ?? 0 }, "chat");
      }
    }
    res.end();
  }

  async attachment(name: string, path: string): Promise<string> {
    await this.dsas.require(name);
    return resolveAttachment(this.profiles.profileDir(name), path);
  }

  async approve(name: string, runId: string, choice: string, requestId?: string): Promise<void> {
    await this.hermes.json(name, `/v1/runs/${encodeURIComponent(runId)}/approval`, {
      method: "POST",
      json: { choice, ...(requestId && { request_id: requestId }) },
    });
  }

  async stopRun(name: string, runId: string): Promise<void> {
    await this.hermes.json(name, `/v1/runs/${encodeURIComponent(runId)}/stop`, { method: "POST", json: {} });
  }

  async routines(name: string): Promise<Routine[]> {
    await this.dsas.require(name);
    const { jobs } = await this.hermes.json<{ jobs: HermesJob[] }>(name, "/api/jobs?include_disabled=true");
    return jobs.map(toRoutine);
  }

  async createRoutine(name: string, input: RoutineInput): Promise<Routine> {
    await this.dsas.require(name);
    const { job } = await this.hermes.json<{ job: HermesJob }>(name, "/api/jobs", {
      method: "POST",
      json: { ...input, deliver: "local" },
    });
    return toRoutine(job);
  }

  async updateRoutine(name: string, id: string, patch: Partial<RoutineInput>): Promise<Routine> {
    const { job } = await this.hermes.json<{ job: HermesJob }>(name, `/api/jobs/${this.jobId(id)}`, { method: "PATCH", json: patch });
    return toRoutine(job);
  }

  async routineAction(name: string, id: string, action: "pause" | "resume" | "run"): Promise<void> {
    await this.hermes.json(name, `/api/jobs/${this.jobId(id)}/${action}`, { method: "POST", json: {} });
  }

  async removeRoutine(name: string, id: string): Promise<void> {
    await this.hermes.json(name, `/api/jobs/${this.jobId(id)}`, { method: "DELETE" });
  }

  async routineRuns(name: string, id: string, limit = 20): Promise<RoutineRun[]> {
    await this.dsas.require(name);
    return readRuns(this.profiles.profileDir(name), this.jobId(id), limit);
  }

  private jobId(id: string): string {
    if (!JOB_ID.test(id)) throw new BadRequestException("Rutina inválida");
    return id;
  }
}
