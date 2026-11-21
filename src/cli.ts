#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { apiClient, loadMackEnv } from "./api-client.js";

const USAGE = `mackctl <command>   (habla con el control plane en $MACK_URL)

  init [--no-start]                        Provisiona a Mack (perfil orquestador de Hermes)
  create <plantilla|spec.yaml> [--name]    Crea un DSA desde una plantilla o un spec
  agents | health | ledger                 Estado general
  rm <nombre>                              Elimina un DSA
  route "<tarea>"                          Qué DSA atendería la tarea
  dispatch "<tarea>" [--agent nombre]      Ejecuta la tarea vía Matrix
  build <repo> "<tarea>" [--workflow implement|implement-review] [--branch b]
                                           Encola un trabajo en el Factory (Sandcastle)
  jobs [id]                                Trabajos del Factory`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "no-start": { type: "boolean", default: false },
    name: { type: "string" },
    agent: { type: "string" },
    workflow: { type: "string" },
    branch: { type: "string" },
  },
});

const [command, ...args] = positionals;
if (!command || command === "help") {
  console.log(USAGE);
  process.exit(0);
}

loadMackEnv();
const api = apiClient();

const run: Record<string, () => Promise<unknown>> = {
  init: () => api("POST", "/api/orchestrator/init", { start: !values["no-start"] }),
  create: async () => {
    const [source] = args;
    if (!source) throw new Error("create <plantilla|spec.yaml>");
    if (!existsSync(source)) return api("POST", `/api/templates/${source}/instantiate`, values.name ? { name: values.name } : {});
    const spec = parse(readFileSync(source, "utf8"));
    return api("POST", "/api/agents", { ...spec, ...(values.name ? { name: values.name } : {}) });
  },
  agents: () => api("GET", "/api/agents"),
  health: () => api("GET", "/api/agents/health"),
  ledger: () => api("GET", "/api/ledger/summary"),
  rm: () => api("DELETE", `/api/agents/${args[0]}`),
  route: () => api("POST", "/api/matrix/route", { task: args[0] }),
  dispatch: () => api("POST", "/api/matrix/dispatch", { task: args[0], agent: values.agent }),
  build: () =>
    api("POST", "/api/factory/jobs", {
      repo: resolve(args[0]),
      task: args[1],
      ...(values.workflow && { workflow: values.workflow }),
      ...(values.branch && { branch: values.branch }),
    }),
  jobs: () => api("GET", args[0] ? `/api/factory/jobs/${args[0]}` : "/api/factory/jobs"),
};

const handler = run[command];
if (!handler) {
  console.log(USAGE);
  process.exit(1);
}
console.log(JSON.stringify(await handler(), null, 2));
