import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * MCP bridge Hermes loads into the orchestrator profile (mcp_servers.mack).
 * It is a thin client of the control plane so all state lives in one process.
 */
const baseUrl = process.env.MACK_URL ?? "http://127.0.0.1:7777";
const token = process.env.MACK_TOKEN;
if (!token) throw new Error("MACK_TOKEN is required");

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const asText = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

const server = new McpServer({ name: "mack", version: "0.1.0" });

const dispatchShape = {
  task: z.string().describe("Tarea completa y autocontenida para el DSA"),
  agent: z.string().optional().describe("Nombre del DSA; omítelo para que Matrix enrute por dominio"),
  context: z.string().optional().describe("Contexto extra (preferencias del usuario, datos previos)"),
};

server.registerTool(
  "factory_list",
  { description: "Lista los agentes (orquestador + DSAs) y las plantillas disponibles en el Factory." },
  async () => asText({ agents: await api("GET", "/api/agents"), templates: await api("GET", "/api/templates") }),
);

server.registerTool(
  "factory_create_dsa",
  {
    description:
      "Crea un Domain Specific Agent nuevo: perfil Hermes aislado con su SOUL, modelo, skill packs, API server y presupuesto. " +
      "Usa la skill mack-factory para redactar el spec antes de llamar esto.",
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
      }),
    },
  },
  async ({ spec }) => asText(await api("POST", "/api/agents", spec)),
);

server.registerTool(
  "factory_instantiate_template",
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

await server.connect(new StdioServerTransport());
