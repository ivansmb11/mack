import type { AgentRecord, Factory } from "./factory.ts";
import type { Ledger, Usage } from "./ledger.ts";

export interface DispatchRequest {
  task: string;
  agent?: string;
  context?: string;
}

export interface DispatchResult {
  agent: string;
  status: "ok" | "out_of_domain" | "error";
  content: string;
  usage?: Usage;
}

export interface RouteDecision {
  agent: string | null;
  score: number;
  candidates: { agent: string; score: number }[];
}

const OUT_OF_DOMAIN = "FUERA_DE_DOMINIO";
const DISPATCH_TIMEOUT_MS = 15 * 60_000;

export const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * Deterministic keyword router over each DSA's declared domains.
 * A null agent means no DSA claims the task and Mack should handle it itself.
 */
export function route(task: string, agents: AgentRecord[]): RouteDecision {
  const words = new Set(normalize(task).split(/[^\p{L}\p{N}+#.-]+/u));
  const haystack = normalize(task);
  const candidates = agents
    .filter((a) => a.kind === "dsa")
    .map((a) => ({
      agent: a.name,
      score: a.domains.reduce((sum, d) => {
        const domain = normalize(d);
        return sum + (domain.includes(" ") ? Number(haystack.includes(domain)) * 2 : Number(words.has(domain)));
      }, 0),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { agent: best?.agent ?? null, score: best?.score ?? 0, candidates };
}

export function createMatrix(deps: { factory: Factory; ledger: Ledger; fetch?: typeof fetch }) {
  const { factory, ledger } = deps;
  const doFetch = deps.fetch ?? fetch;

  const dispatch = async (req: DispatchRequest): Promise<DispatchResult> => {
    const name = req.agent ?? route(req.task, factory.list()).agent;
    if (!name) return { agent: "", status: "out_of_domain", content: "Ningún DSA cubre esta tarea." };
    const agent = factory.get(name);
    if (!agent) return { agent: name, status: "error", content: `DSA "${name}" no existe.` };

    ledger.assertWithinBudget(agent.name);

    const messages = [
      ...(req.context ? [{ role: "system", content: req.context }] : []),
      { role: "user", content: req.task },
    ];
    const res = await doFetch(`http://127.0.0.1:${agent.port}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${factory.apiKey(agent.name)}` },
      body: JSON.stringify({ model: agent.name, messages, stream: false }),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (!res.ok) return { agent: agent.name, status: "error", content: `HTTP ${res.status}: ${await res.text()}` };

    const body = (await res.json()) as { choices: { message: { content: string } }[]; usage?: Usage };
    if (body.usage) ledger.record(agent.name, agent.model, body.usage, "matrix");
    const content = body.choices[0]?.message.content ?? "";
    return {
      agent: agent.name,
      status: content.trimStart().startsWith(OUT_OF_DOMAIN) ? "out_of_domain" : "ok",
      content,
      usage: body.usage,
    };
  };

  return {
    route: (task: string) => route(task, factory.list()),
    dispatch,

    async fanout(requests: DispatchRequest[]): Promise<DispatchResult[]> {
      const settled = await Promise.allSettled(requests.map(dispatch));
      return settled.map((s, i) =>
        s.status === "fulfilled"
          ? s.value
          : { agent: requests[i].agent ?? "", status: "error", content: String(s.reason?.message ?? s.reason) },
      );
    },

    async health(): Promise<{ agent: string; port: number; up: boolean }[]> {
      return Promise.all(
        factory.list().map(async (a) => {
          const up = await doFetch(`http://127.0.0.1:${a.port}/v1/models`, {
            headers: { authorization: `Bearer ${factory.apiKey(a.name)}` },
            signal: AbortSignal.timeout(3_000),
          })
            .then((r) => r.ok)
            .catch(() => false);
          return { agent: a.name, port: a.port, up };
        }),
      );
    },
  };
}

export type Matrix = ReturnType<typeof createMatrix>;
