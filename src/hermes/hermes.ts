import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";

const run = promisify(execFile);

/** Boundary to the Hermes CLI and its on-disk profile layout (~/.hermes/profiles/<name>/). */
export interface Hermes {
  profileDir(name: string): string;
  createProfile(name: string): Promise<void>;
  deleteProfile(name: string): Promise<void>;
  startGateway(name: string): Promise<void>;
  stopGateway(name: string): Promise<void>;
}

export function cliHermes(bin: string, home: string): Hermes {
  const hermes = (...args: string[]) => run(bin, args, { timeout: 120_000 });
  return {
    profileDir: (name) => join(home, "profiles", name),
    createProfile: async (name) => void (await hermes("profile", "create", name)),
    deleteProfile: async (name) => void (await hermes("profile", "delete", name, "--yes")),
    startGateway: async (name) => {
      await hermes("-p", name, "gateway", "install");
      await hermes("-p", name, "gateway", "start");
    },
    stopGateway: async (name) => void (await hermes("-p", name, "gateway", "stop")),
  };
}

/** In-process stand-in for tests and `--dry-run`: lays out the profile dir without touching Hermes. */
export function fakeHermes(home: string): Hermes & { gateways: Set<string> } {
  const gateways = new Set<string>();
  return {
    gateways,
    profileDir: (name) => join(home, "profiles", name),
    createProfile: async (name) => void mkdirSync(join(home, "profiles", name), { recursive: true }),
    deleteProfile: async (name) => rmSync(join(home, "profiles", name), { recursive: true, force: true }),
    startGateway: async (name) => void gateways.add(name),
    stopGateway: async (name) => void gateways.delete(name),
  };
}

export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const entries = readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")] as const;
    });
  return Object.fromEntries(entries);
}

export function writeEnvFile(path: string, values: Record<string, string>): void {
  const merged = { ...readEnvFile(path), ...values };
  writeFileSync(path, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  chmodSync(path, 0o600);
}

type Yaml = Record<string, unknown>;

const isObject = (v: unknown): v is Yaml => typeof v === "object" && v !== null && !Array.isArray(v);

export function deepMerge(base: Yaml, patch: Yaml): Yaml {
  const out: Yaml = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isObject(value) && isObject(out[key]) ? deepMerge(out[key] as Yaml, value) : value;
  }
  return out;
}

/** Merges into the profile's config.yaml so defaults written by `hermes profile create` survive. */
export function patchConfigYaml(path: string, patch: Yaml): void {
  const current = existsSync(path) ? ((parse(readFileSync(path, "utf8")) as Yaml | null) ?? {}) : {};
  writeFileSync(path, stringify(deepMerge(current, patch)));
}

export const HERMES = Symbol("HERMES");
