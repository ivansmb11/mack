import { randomBytes } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import { DsaService } from "../dsa/dsa.service.js";
import type { Group, GroupMessage } from "../generated/prisma/client.js";
import { BudgetExceededError } from "../ledger/budget-exceeded.error.js";
import type { Usage } from "../ledger/ledger.schemas.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { route } from "../matrix/route.js";
import { MACK_CONFIG, type MackConfig } from "../config/config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { GroupInput } from "./bots.schemas.js";
import { HermesApi } from "./hermes-api.js";
import { openSse } from "./sse.js";

export type GroupRecord = Omit<Group, "members"> & { members: string[] };
export type GroupSummary = GroupRecord & { lastMessage: GroupMessage | null };

/** Keeps a single message from turning into an endless bot-to-bot exchange. */
const MAX_BOT_TURNS = 6;
const TRANSCRIPT_WINDOW = 40;
const USER = "user";

const toRecord = ({ members, ...group }: Group): GroupRecord => ({ ...group, members: members as string[] });

/** @names in order of appearance, kept only when they belong to the group. */
export function mentions(text: string, members: string[]): string[] {
  const found = [...text.matchAll(/@([a-z][a-z0-9-]{1,30})/g)].map((m) => m[1]);
  return [...new Set(found)].filter((n) => members.includes(n));
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dsas: DsaService,
    private readonly ledger: LedgerService,
    private readonly hermes: HermesApi,
    @Inject(MACK_CONFIG) private readonly config: MackConfig,
  ) {}

  async list(): Promise<GroupSummary[]> {
    const groups = await this.prisma.group.findMany({
      orderBy: { createdAt: "asc" },
      include: { messages: { orderBy: { id: "desc" }, take: 1 } },
    });
    return groups.map(({ messages, ...g }) => ({ ...toRecord(g), lastMessage: messages[0] ?? null }));
  }

  async require(id: string): Promise<GroupRecord> {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException(`Grupo "${id}" no existe`);
    return toRecord(group);
  }

  async create(input: GroupInput): Promise<GroupRecord> {
    await this.assertMembers(input.members);
    const group = await this.prisma.group.create({
      data: { id: `g-${randomBytes(4).toString("hex")}`, name: input.name, members: [...new Set(input.members)] },
    });
    return toRecord(group);
  }

  async update(id: string, patch: Partial<GroupInput>): Promise<GroupRecord> {
    await this.require(id);
    if (patch.members) await this.assertMembers(patch.members);
    const group = await this.prisma.group.update({
      where: { id },
      data: { ...(patch.name && { name: patch.name }), ...(patch.members && { members: [...new Set(patch.members)] }) },
    });
    return toRecord(group);
  }

  async remove(id: string): Promise<void> {
    await this.require(id);
    await this.prisma.group.delete({ where: { id } });
  }

  messages(id: string, take = 300): Promise<GroupMessage[]> {
    return this.prisma.groupMessage.findMany({ where: { groupId: id }, orderBy: { id: "asc" }, take: -take });
  }

  /**
   * Posts Iván's message and lets the bots answer in turn: whoever Iván @mentions, else whoever Matrix
   * routes to, else the orchestrator. Bots that @mention another member hand the conversation on.
   * The work continues even if the browser disconnects; every message is persisted as it lands.
   */
  async post(id: string, content: string, res: Response): Promise<void> {
    const group = await this.require(id);
    const send = openSse(res);
    send("message", await this.save(id, USER, content));

    const queue = await this.firstResponders(group, content);
    for (let turn = 0; turn < MAX_BOT_TURNS && queue.length; turn++) {
      const agent = queue.shift()!;
      send("typing", { agent });
      const reply = await this.ask(group, agent);
      send("message", reply);
      if (!reply.error) queue.push(...mentions(reply.content, group.members).filter((n) => n !== agent && !queue.includes(n)));
    }
    send("done", {});
    res.end();
  }

  private async firstResponders(group: GroupRecord, content: string): Promise<string[]> {
    const mentioned = mentions(content, group.members);
    if (mentioned.length) return mentioned;
    const agents = (await this.dsas.list()).filter((a) => group.members.includes(a.name));
    const routed = route(content, agents).agent;
    if (routed) return [routed];
    const orchestrator = this.config.hermes.orchestrator;
    return [group.members.includes(orchestrator) ? orchestrator : group.members[0]];
  }

  private async ask(group: GroupRecord, name: string): Promise<GroupMessage> {
    const agent = await this.dsas.get(name);
    if (!agent) return this.save(group.id, name, `@${name} ya no existe. Quítalo del grupo.`, true);
    try {
      await this.ledger.assertWithinBudget(name);
    } catch (err) {
      if (err instanceof BudgetExceededError) return this.save(group.id, name, `Llegué a mi presupuesto del mes (${err.message}).`, true);
      throw err;
    }

    const history = await this.messages(group.id, TRANSCRIPT_WINDOW);
    const others = group.members.filter((m) => m !== name).map((m) => `@${m}`);
    const system = [
      `Estás en el grupo "${group.name}" de Mack con Iván${others.length ? ` y ${others.join(", ")}` : ""}.`,
      "Contesta solo tu parte, breve y directa. Si otro bot debe seguir, menciónalo con @nombre; si no, no menciones a nadie.",
    ].join(" ");
    const transcript = history.map((m) => `[${m.author === USER ? "Iván" : `@${m.author}`}]: ${m.content}`).join("\n\n");

    try {
      const body = await this.hermes.json<{ choices: { message: { content: string } }[]; usage?: Usage }>(name, "/v1/chat/completions", {
        method: "POST",
        json: {
          model: name,
          stream: false,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `${transcript}\n\nTe toca a ti, @${name}.` },
          ],
        },
        signal: AbortSignal.timeout(15 * 60_000),
      });
      if (body.usage) await this.ledger.record(name, agent.model, body.usage, "group");
      return this.save(group.id, name, body.choices[0]?.message.content?.trim() || "(sin respuesta)");
    } catch (err) {
      return this.save(group.id, name, `No pude responder: ${(err as Error).message}`, true);
    }
  }

  private save(groupId: string, author: string, content: string, error = false): Promise<GroupMessage> {
    return this.prisma.groupMessage.create({ data: { groupId, author, content, error } });
  }

  private async assertMembers(members: string[]): Promise<void> {
    const known = new Set((await this.dsas.list()).map((a) => a.name));
    const missing = members.filter((m) => !known.has(m));
    if (missing.length) throw new BadRequestException(`No existen: ${missing.join(", ")}`);
  }
}
