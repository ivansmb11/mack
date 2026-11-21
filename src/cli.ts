#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { PROJECT_ROOT, requireEnv } from "./config.ts";
import { createSystem } from "./system.ts";

const USAGE = `mackctl <command>

  init [--dry-run] [--no-start]          Provisiona a Mack (perfil orquestador de Hermes)
  create <plantilla|spec.yaml> [--name]  Crea un DSA desde una plantilla o un spec
  agents                                 Lista agentes
  health                                 Estado del API server de cada agente
  rm <nombre>                            Elimina un DSA
  route "<tarea>"                        Qué DSA atendería la tarea
  dispatch "<tarea>" [--agent nombre]    Ejecuta la tarea vía Matrix
  ledger                                 Resumen de tokens, presupuestos y suscripciones`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    "no-start": { type: "boolean", default: false },
    name: { type: "string" },
    agent: { type: "string" },
  },
});

const [command, arg] = positionals;
const print = (data: unknown) => console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));

if (!command || command === "help") {
  print(USAGE);
  process.exit(0);
}

const system = createSystem({ dryRun: values["dry-run"] });
const { config, factory, matrix, ledger, templates } = system;
const start = !values["no-start"] && !values["dry-run"];

switch (command) {
  case "init": {
    const spec = parse(readFileSync(join(PROJECT_ROOT, "hermes/mack.yaml"), "utf8"));
    spec.skillDirs = [join(PROJECT_ROOT, "hermes/skills")];
    spec.mcpServers = {
      mack: {
        command: process.execPath,
        args: [join(PROJECT_ROOT, "src/mcp.ts")],
        env: { MACK_URL: `http://${config.server.host}:${config.server.port}`, MACK_TOKEN: requireEnv("MACK_TOKEN") },
      },
    };
    print(await factory.create(spec, { kind: "orchestrator", start }));
    break;
  }
  case "create": {
    if (!arg) throw new Error("create <plantilla|spec.yaml>");
    const base = existsSync(arg) ? parse(readFileSync(arg, "utf8")) : templates.get(arg);
    if (!base) throw new Error(`"${arg}" no es archivo ni plantilla. Plantillas: ${[...templates.keys()].join(", ")}`);
    print(await factory.create({ ...base, ...(values.name ? { name: values.name } : {}) }, { start }));
    break;
  }
  case "agents":
    print(factory.list());
    break;
  case "health":
    print(await matrix.health());
    break;
  case "rm":
    await factory.remove(arg);
    print(`eliminado: ${arg}`);
    break;
  case "route":
    print(matrix.route(arg));
    break;
  case "dispatch":
    print(await matrix.dispatch({ task: arg, agent: values.agent }));
    break;
  case "ledger":
    print(ledger.summary());
    break;
  default:
    print(USAGE);
    process.exit(1);
}
