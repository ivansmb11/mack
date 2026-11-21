import { Inject, Injectable } from "@nestjs/common";
import { DsaService } from "../dsa/dsa.service.js";
import type { Usage } from "../ledger/ledger.schemas.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { FETCH, type Fetch } from "./fetch.js";
import type { DispatchRequest } from "./matrix.schemas.js";
import { route, type RouteDecision } from "./route.js";

export interface DispatchResult {
  agent: string;
  status: "ok" | "out_of_domain" | "error";
  content: string;
  usage?: Usage;
}

const OUT_OF_DOMAIN = "FUERA_DE_DOMINIO";
const DISPATCH_TIMEOUT_MS = 15 * 60_000;

/** Matrix: routes tasks to DSAs over their OpenAI-compatible Hermes API servers, enforcing budgets. */
@Injectable()
export class MatrixService {
  constructor(
    private readonly dsas: DsaService,
    private readonly ledger: LedgerService,
    @Inject(FETCH) private readonly fetch: Fetch,
  ) {}

  async route(task: string): Promise<RouteDecision> {
    return route(task, await this.dsas.list());
  }

  async dispatch(req: DispatchRequest): Promise<DispatchResult> {
    const name = req.agent ?? (await this.route(req.task)).agent;
    if (!name) return { agent: "", status: "out_of_domain", content: "Ningún DSA cubre esta tarea." };
    const agent = await this.dsas.get(name);
    if (!agent) return { agent: name, status: "error", content: `DSA "${name}" no existe.` };

    await this.ledger.assertWithinBudget(agent.name);

    const messages = [
      ...(req.context ? [{ role: "system", content: req.context }] : []),
      { role: "user", content: req.task },
    ];
    const res = await this.fetch(`http://127.0.0.1:${agent.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.dsas.apiKey(agent.name)}` },
      body: JSON.stringify({ model: agent.name, messages, stream: false }),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (!res.ok) return { agent: agent.name, status: "error", content: `HTTP ${res.status}: ${await res.text()}` };

    const body = (await res.json()) as { choices: { message: { content: string } }[]; usage?: Usage };
    if (body.usage) await this.ledger.record(agent.name, agent.model, body.usage, "matrix");
    const content = body.choices[0]?.message.content ?? "";
    return {
      agent: agent.name,
      status: content.trimStart().startsWith(OUT_OF_DOMAIN) ? "out_of_domain" : "ok",
      content,
      usage: body.usage,
    };
  }

  async fanout(requests: DispatchRequest[]): Promise<DispatchResult[]> {
    const settled = await Promise.allSettled(requests.map((r) => this.dispatch(r)));
    return settled.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : { agent: requests[i].agent ?? "", status: "error", content: String(s.reason?.message ?? s.reason) },
    );
  }

  async health(): Promise<{ agent: string; port: number; up: boolean }[]> {
    const agents = await this.dsas.list();
    return Promise.all(
      agents.map(async (a) => {
        const up = await this.fetch(`http://127.0.0.1:${a.port}/v1/models`, {
          headers: { authorization: `Bearer ${this.dsas.apiKey(a.name)}` },
          signal: AbortSignal.timeout(3_000),
        })
          .then((r) => r.ok)
          .catch(() => false);
        return { agent: a.name, port: a.port, up };
      }),
    );
  }
}
