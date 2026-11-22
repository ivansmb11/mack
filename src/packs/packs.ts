import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { z } from "zod";

const git = (cwd: string, ...args: string[]) => promisify(execFile)("git", args, { cwd, timeout: 120_000 });

const PackSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string(),
  repo: z.string(),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/),
  skills: z.array(z.string()).min(1),
});

/** A pinned, curated subset of an upstream skills repo, vendored into one directory Hermes scans. */
export type SkillPack = z.infer<typeof PackSchema>;

export function loadPacks(dir: string): Map<string, SkillPack> {
  const packs = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => PackSchema.parse(parse(readFileSync(join(dir, f), "utf8"))));
  return new Map(packs.map((p) => [p.name, p]));
}

export function packDir(packsHome: string, pack: SkillPack): string {
  return join(packsHome, pack.name);
}

const vendorStamp = (pack: SkillPack) => [pack.commit, ...pack.skills].join("\n");

/** Idempotent: re-vendors only when the pinned commit or the skill list changed. */
export async function vendorPack(packsHome: string, pack: SkillPack): Promise<string> {
  const target = packDir(packsHome, pack);
  const stamp = join(target, ".commit");
  if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === vendorStamp(pack)) return target;

  const checkout = mkdtempSync(join(tmpdir(), `mack-pack-${pack.name}-`));
  try {
    await git(checkout, "init", "-q");
    await git(checkout, "remote", "add", "origin", pack.repo);
    await git(checkout, "fetch", "-q", "--depth", "1", "origin", pack.commit);
    await git(checkout, "checkout", "-q", "FETCH_HEAD");

    rmSync(target, { recursive: true, force: true });
    for (const skillPath of pack.skills) {
      const source = join(checkout, skillPath);
      if (!existsSync(join(source, "SKILL.md"))) throw new Error(`${pack.name}: ${skillPath} has no SKILL.md at ${pack.commit}`);
      cpSync(source, join(target, basename(skillPath)), { recursive: true });
    }
    writeFileSync(stamp, vendorStamp(pack) + "\n");
    return target;
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
}
