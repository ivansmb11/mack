import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";

const run = promisify(execFile);

/**
 * Boundary to the Hermes CLI and its on-disk profile layout (~/.hermes/profiles/<name>/).
 * Hermes ≥ 0.23 serves every unparked profile from the single host gateway (rescan ≤ 30s),
 * so "serving" a profile means unparking it, never starting a process of its own.
 */
export interface Hermes {
  profileDir(name: string): string;
  createProfile(name: string): Promise<void>;
  deleteProfile(name: string): Promise<void>;
  serve(name: string): Promise<void>;
  park(name: string): Promise<void>;
}

/** Documented provisioning hook: a profile created with this marker stays offline until `gateway start`. */
const PARKED_MARKER = "gateway.parked";

export function cliHermes(bin: string, home: string): Hermes {
  const hermes = (...args: string[]) => run(bin, args, { timeout: 120_000 });
  const profileDir = (name: string) => join(home, "profiles", name);
  return {
    profileDir,
    createProfile: async (name) => void (await hermes("profile", "create", name)),
    deleteProfile: async (name) => void (await hermes("profile", "delete", name, "--yes")),
    serve: async (name) => void (await hermes("-p", name, "gateway", "start")),
    park: async (name) => writeFileSync(join(profileDir(name), PARKED_MARKER), ""),
  };
}

/** In-process stand-in for tests and MACK_DRY_RUN: lays out profile dirs and models parking. */
export function fakeHermes(home: string): Hermes & { served(name: string): boolean } {
  const profileDir = (name: string) => join(home, "profiles", name);
  const marker = (name: string) => join(profileDir(name), PARKED_MARKER);
  return {
    profileDir,
    served: (name) => existsSync(profileDir(name)) && !existsSync(marker(name)),
    createProfile: async (name) => void mkdirSync(profileDir(name), { recursive: true }),
    deleteProfile: async (name) => rmSync(profileDir(name), { recursive: true, force: true }),
    serve: async (name) => rmSync(marker(name), { force: true }),
    park: async (name) => writeFileSync(marker(name), ""),
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

export function writeEnvFile(path: string, values: Record<string, string>, opts: { drop?: string[] } = {}): void {
  const current = Object.entries(readEnvFile(path)).filter(([k]) => !opts.drop?.includes(k));
  const merged = { ...Object.fromEntries(current), ...values };
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
