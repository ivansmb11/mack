import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, del, patch, post, put } from "@/lib/api";
import type {
  Agent,
  AgentBudget,
  AgentHealth,
  AgentSpec,
  Bot,
  BotProfile,
  Budget,
  ChatMessage,
  Group,
  GroupMessage,
  LookRecommendation,
  Routine,
  RoutineRun,
  DispatchResult,
  Job,
  JobStep,
  JobWorkflow,
  LedgerSummary,
  RouteDecision,
  Subscription,
} from "@/lib/types";

type Look = { avatar: string; color: string };

export const keys = {
  bots: ["bots"],
  bot: (name: string) => ["bots", name],
  messages: (name: string) => ["bots", name, "messages"],
  routines: (name: string) => ["bots", name, "routines"],
  routineRuns: (name: string, id: string) => ["bots", name, "routines", id, "runs"],
  groups: ["groups"],
  groupMessages: (id: string) => ["groups", id, "messages"],
  agents: ["agents"],
  health: ["agents", "health"],
  templates: ["templates"],
  jobs: ["jobs"],
  jobSteps: (id: string) => ["jobs", id, "steps"],
  ledger: ["ledger"],
  budgets: ["ledger", "budgets"],
} as const;

const ACTIVE_JOB = new Set(["queued", "running"]);

export const useAgents = () => useQuery({ queryKey: keys.agents, queryFn: () => api<Agent[]>("/api/agents") });
export const useHealth = () =>
  useQuery({ queryKey: keys.health, queryFn: () => api<AgentHealth[]>("/api/agents/health"), refetchInterval: 30_000 });
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** The look Mack gives a bot nobody picked one for; refreshes as its name and topics are typed. */
export function useRecommendedLook(bot: { name: string; description?: string; domains?: string[] }, enabled = true) {
  const settled = useDebounced(JSON.stringify(bot), 300);
  return useQuery({
    queryKey: ["recommended-look", settled],
    queryFn: () => post<LookRecommendation>("/api/agents/recommend-look", JSON.parse(settled)),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const useTemplates = () => useQuery({ queryKey: keys.templates, queryFn: () => api<AgentSpec[]>("/api/templates") });
export const useJobs = () =>
  useQuery({
    queryKey: keys.jobs,
    queryFn: () => api<Job[]>("/api/factory/jobs?limit=50"),
    refetchInterval: (q) => (q.state.data?.some((j) => ACTIVE_JOB.has(j.status)) ? 4_000 : 30_000),
  });
/** A job's timeline; while it runs, polls only for steps newer than the last one already held. */
export function useJobSteps(id: string, live: boolean) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: keys.jobSteps(id),
    queryFn: async () => {
      const held = client.getQueryData<JobStep[]>(keys.jobSteps(id)) ?? [];
      const after = held.at(-1)?.id ?? 0;
      const fresh = await api<JobStep[]>(`/api/factory/jobs/${id}/steps?after=${after}`);
      return fresh.length ? [...held, ...fresh] : held;
    },
    refetchInterval: live ? 2_000 : false,
  });
  const { refetch } = query;
  // The last steps land just before the job flips to finished; one more read once it stops being live catches them.
  useEffect(() => {
    if (!live) void refetch();
  }, [live, refetch]);
  return query;
}
export const useLedger = () => useQuery({ queryKey: keys.ledger, queryFn: () => api<LedgerSummary>("/api/ledger/summary") });
export const useBudgets = () => useQuery({ queryKey: keys.budgets, queryFn: () => api<AgentBudget[]>("/api/ledger/budgets") });

const fail = (err: Error) => toast.error(err.message);

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ({ template: string; name?: string } & Partial<Look>) | { yaml: string } | { spec: Partial<AgentSpec> & Partial<Look> }) =>
      "yaml" in input
        ? api<Agent>("/api/agents", { method: "POST", yaml: input.yaml })
        : "spec" in input
          ? post<Agent>("/api/agents", input.spec)
          : post<Agent>(`/api/templates/${input.template}/instantiate`, {
              ...(input.name && { name: input.name }),
              ...(input.color && { color: input.color }),
              ...(input.avatar && { avatar: input.avatar }),
            }),
    onSuccess: (agent) => {
      toast.success(`${agent.name} ya es parte del equipo. Hermes lo levanta en menos de 30 s.`);
      qc.invalidateQueries({ queryKey: keys.agents });
      qc.invalidateQueries({ queryKey: keys.bots });
      qc.invalidateQueries({ queryKey: keys.budgets });
    },
    onError: fail,
  });
}

export function useAgentAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, action }: { name: string; action: "start" | "stop" | "remove" }) =>
      action === "remove" ? del(`/api/agents/${name}`) : post(`/api/agents/${name}/${action}`),
    onSuccess: (_, { name, action }) => {
      toast.success({ start: `${name} reactivado.`, stop: `${name} estacionado.`, remove: `${name} eliminado.` }[action]);
      qc.invalidateQueries({ queryKey: keys.agents });
      qc.invalidateQueries({ queryKey: keys.bots });
    },
    onError: fail,
  });
}

export const useRoute = () =>
  useMutation({ mutationFn: (task: string) => post<RouteDecision>("/api/matrix/route", { task }), onError: fail });

export function useDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tasks: { task: string; agent?: string; context?: string }[]) =>
      tasks.length === 1
        ? post<DispatchResult>("/api/matrix/dispatch", tasks[0]).then((r) => [r])
        : post<DispatchResult[]>("/api/matrix/fanout", tasks),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.ledger }),
    onError: fail,
  });
}

export function useSubmitJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (job: { repo: string; task: string; workflow: JobWorkflow; branch?: string; setupCommand?: string; maxIterations?: number }) =>
      post<Job>("/api/factory/jobs", job),
    onSuccess: (job) => {
      toast.success(`Trabajo encolado en la rama ${job.branch}.`);
      qc.invalidateQueries({ queryKey: keys.jobs });
    },
    onError: fail,
  });
}

export function useSaveSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Subscription) => put<Subscription>("/api/ledger/subscriptions", s),
    onSuccess: (s) => {
      toast.success(`Suscripción ${s.plan} guardada.`);
      qc.invalidateQueries({ queryKey: keys.ledger });
    },
    onError: fail,
  });
}

export function useRemoveSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/api/ledger/subscriptions/${id}`),
    onSuccess: () => {
      toast.success("Suscripción eliminada.");
      qc.invalidateQueries({ queryKey: keys.ledger });
    },
    onError: fail,
  });
}

export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agent, budget }: { agent: string; budget: Budget }) => put<Budget>(`/api/ledger/budgets/${agent}`, budget),
    onSuccess: (_, { agent }) => {
      toast.success(`Presupuesto de ${agent} guardado.`);
      qc.invalidateQueries({ queryKey: keys.budgets });
      qc.invalidateQueries({ queryKey: keys.ledger });
    },
    onError: fail,
  });
}

export const useBots = () => useQuery({ queryKey: keys.bots, queryFn: () => api<Bot[]>("/api/bots"), refetchInterval: 30_000 });
export const useBotProfile = (name: string) => useQuery({ queryKey: keys.bot(name), queryFn: () => api<BotProfile>(`/api/bots/${name}`) });
/** Polls so routine results show up on their own; paused mid-turn so the live reply isn't shown twice. */
export const useBotMessages = (name: string, { poll = true } = {}) =>
  useQuery({
    queryKey: keys.messages(name),
    queryFn: () => api<ChatMessage[]>(`/api/bots/${name}/messages`),
    refetchInterval: poll ? 30_000 : false,
  });
export const useRoutines = (name: string) =>
  useQuery({ queryKey: keys.routines(name), queryFn: () => api<Routine[]>(`/api/bots/${name}/routines`) });
export const useRoutineRuns = (name: string, id: string, enabled: boolean) =>
  useQuery({ queryKey: keys.routineRuns(name, id), queryFn: () => api<RoutineRun[]>(`/api/bots/${name}/routines/${id}/runs`), enabled });
export const useGroups = () => useQuery({ queryKey: keys.groups, queryFn: () => api<Group[]>("/api/groups") });
export const useGroupMessages = (id: string) =>
  useQuery({ queryKey: keys.groupMessages(id), queryFn: () => api<GroupMessage[]>(`/api/groups/${id}/messages`) });

export type BotPatch = Partial<{ description: string; domains: string[]; instructions: string; color: string; avatar: string; model: { provider: string; default: string } }>;

export function useUpdateBot(name: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: BotPatch) => patch<Agent>(`/api/bots/${name}`, p),
    onSuccess: (_, p) => {
      const onlyLook = Object.keys(p).every((k) => k === "avatar" || k === "color");
      if (!onlyLook) toast.success(`${name} actualizado. Lo aplica desde su siguiente mensaje.`);
      qc.invalidateQueries({ queryKey: keys.bots });
      qc.invalidateQueries({ queryKey: keys.bot(name) });
    },
    onError: fail,
  });
}

export type RoutineInput = { name: string; prompt: string; schedule: string; timezone?: string };

export function useRoutineMutations(name: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.routines(name) });
  return {
    create: useMutation({
      mutationFn: (r: RoutineInput) => post<Routine>(`/api/bots/${name}/routines`, r),
      onSuccess: (r) => (toast.success(`Rutina "${r.name}" creada.`), refresh()),
      onError: fail,
    }),
    action: useMutation({
      mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "run" }) => post(`/api/bots/${name}/routines/${id}/${action}`),
      onSuccess: (_, { action }) => {
        if (action === "run") toast.success("Corre en el siguiente tick del scheduler. El resultado aparece en su historial.");
        refresh();
      },
      onError: fail,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/api/bots/${name}/routines/${id}`),
      onSuccess: () => (toast.success("Rutina eliminada."), refresh()),
      onError: fail,
    }),
  };
}

export function useGroupMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.groups });
  return {
    create: useMutation({
      mutationFn: (g: { name: string; members: string[] }) => post<Group>("/api/groups", g),
      onSuccess: refresh,
      onError: fail,
    }),
    update: useMutation({
      mutationFn: ({ id, ...g }: { id: string; name?: string; members?: string[] }) => patch<Group>(`/api/groups/${id}`, g),
      onSuccess: (g) => (toast.success(`Grupo "${g.name}" guardado.`), refresh()),
      onError: fail,
    }),
    remove: useMutation({
      mutationFn: (id: string) => del(`/api/groups/${id}`),
      onSuccess: () => (toast.success("Grupo eliminado."), refresh()),
      onError: fail,
    }),
  };
}
