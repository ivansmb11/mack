import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AVATAR_IDS } from "./dsa/avatars.js";
import { apiClient, loadMackEnv } from "./api-client.js";

loadMackEnv();
const api = apiClient();

const asText = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

const server = new McpServer({ name: "mack", version: "0.1.0" });

const dispatchShape = {
  task: z.string().describe("Tarea completa y autocontenida para el DSA"),
  agent: z.string().optional().describe("Nombre del DSA; omítelo para que Matrix enrute por dominio"),
  context: z.string().optional().describe("Contexto extra (preferencias del usuario, datos previos)"),
};

server.registerTool(
  "dsa_list",
  { description: "Lista los agentes (Mack + DSAs) y las plantillas de DSA disponibles." },
  async () => asText({ agents: await api("GET", "/api/agents"), templates: await api("GET", "/api/templates") }),
);

server.registerTool(
  "dsa_create",
  {
    description:
      "Crea un Domain Specific Agent nuevo: perfil Hermes aislado con su SOUL, modelo, skill packs, API server y presupuesto. " +
      "Usa la skill mack-dsa para redactar el spec antes de llamar esto.",
    inputSchema: {
      spec: z.object({
        name: z.string(),
        description: z.string(),
        domains: z.array(z.string()),
        model: z.object({ provider: z.string(), default: z.string() }),
        packs: z.array(z.string()).optional(),
        disabledToolsets: z.array(z.string()).optional(),
        budget: z.object({ monthlyTokens: z.number().optional(), monthlyUsd: z.number().optional() }).optional(),
        soul: z.string(),
        avatar: z
          .enum(AVATAR_IDS)
          .optional()
          .describe("Forma del avatar. Usa la que Iván eligió; si no eligió, omítelo y Mack recomienda una según los dominios"),
        color: z.string().optional().describe("Color #rrggbb del avatar. Igual que avatar: el de Iván, o se omite"),
      }),
    },
  },
  async ({ spec }) => asText(await api("POST", "/api/agents", spec)),
);

server.registerTool(
  "dsa_instantiate_template",
  {
    description: "Crea un DSA a partir de una plantilla existente, opcionalmente con otro nombre o modelo.",
    inputSchema: { template: z.string(), overrides: z.record(z.string(), z.unknown()).optional() },
  },
  async ({ template, overrides }) => asText(await api("POST", `/api/templates/${template}/instantiate`, overrides ?? {})),
);

server.registerTool(
  "matrix_route",
  { description: "Pregunta a Matrix qué DSA atendería una tarea, sin ejecutarla.", inputSchema: { task: z.string() } },
  async ({ task }) => asText(await api("POST", "/api/matrix/route", { task })),
);

server.registerTool(
  "matrix_dispatch",
  { description: "Envía una tarea a un DSA vía Matrix (revisa presupuesto y registra tokens).", inputSchema: dispatchShape },
  async (req) => asText(await api("POST", "/api/matrix/dispatch", req)),
);

server.registerTool(
  "matrix_fanout",
  {
    description: "Envía varias tareas independientes a DSAs en paralelo y regresa todos los resultados.",
    inputSchema: { tasks: z.array(z.object(dispatchShape)).min(1) },
  },
  async ({ tasks }) => asText(await api("POST", "/api/matrix/fanout", tasks)),
);

server.registerTool(
  "matrix_health",
  { description: "Estado (arriba/abajo) del API server de cada agente." },
  async () => asText(await api("GET", "/api/agents/health")),
);

server.registerTool(
  "ledger_summary",
  { description: "Gasto del mes: tokens y USD por agente, presupuestos, suscripciones y total." },
  async () => asText(await api("GET", "/api/ledger/summary")),
);

server.registerTool(
  "ledger_upsert_subscription",
  {
    description: "Registra o actualiza una suscripción (p. ej. Claude Max, ChatGPT Plus, OpenRouter).",
    inputSchema: {
      id: z.string().describe("kebab-case, p. ej. claude-max"),
      provider: z.string(),
      plan: z.string(),
      monthlyUsd: z.number(),
      renewsOn: z.string().optional().describe("YYYY-MM-DD"),
      monthlyTokenQuota: z.number().optional(),
      notes: z.string().optional(),
    },
  },
  async (s) => asText(await api("PUT", "/api/ledger/subscriptions", s)),
);

server.registerTool(
  "ledger_set_budget",
  {
    description: "Fija el presupuesto mensual de un agente. Matrix rechaza tareas cuando se excede.",
    inputSchema: { agent: z.string(), monthlyTokens: z.number().optional(), monthlyUsd: z.number().optional() },
  },
  async ({ agent, ...budget }) => asText(await api("PUT", `/api/ledger/budgets/${agent}`, budget)),
);

const jobShape = {
  repo: z.string().describe("Ruta absoluta del repo git local (bajo factory.repoRoots, p. ej. ~/repos/...)"),
  task: z.string().describe("Ticket o spec completo y autocontenido; el agente no ve esta conversación"),
  workflow: z.enum(["implement", "implement-review"]).optional().describe("Default implement-review"),
  branch: z.string().optional().describe("Default mack/<job-id>"),
  baseBranch: z.string().optional(),
  model: z.string().optional(),
  maxIterations: z.number().int().optional(),
  setupCommand: z.string().optional().describe("Comando dentro del sandbox antes de empezar, p. ej. 'npm ci'"),
};

server.registerTool(
  "factory_build",
  {
    description:
      "Encola un trabajo en el Factory: un agente Claude Code AFK en un sandbox Docker (Sandcastle) implementa la tarea " +
      "con las skills de Matt Pocock en su propia rama, sin push. Para tickets independientes, llama una vez por ticket.",
    inputSchema: jobShape,
  },
  async (job) => asText(await api("POST", "/api/factory/jobs", job)),
);

server.registerTool(
  "factory_jobs",
  {
    description: "Estado de los trabajos del Factory: uno por id o los más recientes.",
    inputSchema: { id: z.string().optional() },
  },
  async ({ id }) => asText(await api("GET", id ? `/api/factory/jobs/${id}` : "/api/factory/jobs?limit=20")),
);

await server.connect(new StdioServerTransport());
