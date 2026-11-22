export type AgentKind = "orchestrator" | "dsa";

export interface Agent {
  name: string;
  kind: AgentKind;
  description: string;
  domains: string[];
  provider: string;
  model: string;
  /** open-bot-avatar shape id. */
  avatar: string;
  color: string;
  createdAt: string;
}

export interface LookRecommendation {
  avatar: string;
  color: string;
  /** The word in the bot's name, topics or description that picked the shape; null when nothing matched. */
  because: string | null;
}

export interface AgentHealth {
  agent: string;
  up: boolean;
}

export interface AgentSpec {
  name: string;
  description: string;
  domains: string[];
  model: { provider: string; default: string };
  packs: string[];
  budget?: { monthlyTokens?: number; monthlyUsd?: number };
  soul: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface RouteDecision {
  agent: string | null;
  score: number;
  candidates: { agent: string; score: number }[];
}

export interface DispatchResult {
  agent: string;
  status: "ok" | "out_of_domain" | "error";
  content: string;
  usage?: Usage;
}

export type JobStatus = "queued" | "running" | "done" | "incomplete" | "failed";
export type JobWorkflow = "implement" | "implement-review";

export interface Job {
  id: string;
  repo: string;
  branch: string;
  baseBranch: string;
  workflow: JobWorkflow;
  model: string;
  task: string;
  status: JobStatus;
  commits: string[];
  output: string | null;
  error: string | null;
  maxIterations: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Budget {
  monthlyTokens: number | null;
  monthlyUsd: number | null;
}

export interface Spend {
  tokens: number;
  usd: number;
  unpricedTokens: number;
}

export interface AgentBudget {
  agent: string;
  kind: AgentKind;
  budget: Budget | null;
  spend: Spend;
}

export interface Subscription {
  id: string;
  provider: string;
  plan: string;
  monthlyUsd: number;
  renewsOn: string | null;
  monthlyTokenQuota: number | null;
  notes: string | null;
}

export interface LedgerSummary {
  month: string;
  meteredUsd: number;
  unpricedTokens: number;
  subscriptionsUsd: number;
  totalUsd: number;
  perAgent: { agent: string; tokens: number; usd: number; calls: number; budget: Budget | null }[];
  subscriptions: Subscription[];
}

export interface ChatAttachment {
  kind: "image" | "file";
  name: string;
  path: string;
}

/** A routine's result appears in the bot's chat as if the bot posted it. */
export type ChatMessage =
  | { id: string; role: "user" | "assistant"; content: string; toolsUsed: string[]; attachments: ChatAttachment[]; at: string }
  | { id: string; role: "routine"; content: string; routine: { id: string; name: string }; failed: boolean; at: string };

export interface Bot extends Agent {
  threadId: string | null;
  lastMessage: Pick<ChatMessage, "role" | "content" | "at"> | null;
}

export interface BotProfile extends Agent {
  instructions: string;
  packs: string[];
  budget: Budget | null;
  spend: Spend;
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

export interface RoutineRun {
  id: string;
  at: string;
  output: string;
  failed: boolean;
}

export interface GroupMessage {
  id: number;
  groupId: string;
  author: string;
  content: string;
  error: boolean;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  createdAt: string;
  lastMessage: GroupMessage | null;
}

export type ApprovalChoice = "once" | "session" | "always" | "deny";

export interface ApprovalRequest {
  runId: string;
  requestId?: string;
  description?: string;
  command?: string;
  choices: ApprovalChoice[];
}
