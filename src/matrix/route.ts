import type { AgentRecord } from "../dsa/dsa.service.js";

export interface RouteDecision {
  agent: string | null;
  score: number;
  candidates: { agent: string; score: number }[];
}

export const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * Deterministic keyword router over each DSA's declared domains; multi-word domains weigh double.
 * A null agent means no DSA claims the task and Mack should handle it itself.
 */
export function route(task: string, agents: Pick<AgentRecord, "name" | "kind" | "domains">[]): RouteDecision {
  const haystack = normalize(task);
  const words = new Set(haystack.split(/[^\p{L}\p{N}+#.-]+/u));
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
