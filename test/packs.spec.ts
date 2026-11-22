
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { PROJECT_ROOT } from "../src/config/config.js";
import { loadPacks, vendorPack } from "../src/packs/packs.js";

function fixtureRepo(): { repo: string; commit: string } {
  const repo = mkdtempSync(join(tmpdir(), "mack-skills-repo-"));
  const g = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  g("init", "-q");
  for (const s of ["tdd", "grilling", "unused"]) {
    mkdirSync(join(repo, "skills", s), { recursive: true });
    writeFileSync(join(repo, "skills", s, "SKILL.md"), `---\nname: ${s}\n---\n`);
  }
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "skills");
  return { repo, commit: g("rev-parse", "HEAD") };
}

test("vendors only the pinned skills and skips work when already at that commit", async () => {
  const { repo, commit } = fixtureRepo();
  const home = mkdtempSync(join(tmpdir(), "mack-packs-"));
  const pack = { name: "mp", description: "d", repo, commit, skills: ["skills/tdd", "skills/grilling"] };

  const dir = await vendorPack(home, pack);
  expect(existsSync(join(dir, "tdd", "SKILL.md"))).toBeTruthy();
  expect(existsSync(join(dir, "grilling", "SKILL.md"))).toBeTruthy();
  expect(!existsSync(join(dir, "unused"))).toBe(true);
  expect(readFileSync(join(dir, ".commit"), "utf8").split("\n")[0]).toBe(commit);

  await vendorPack(home, { ...pack, repo: "/does/not/exist" });
});

test("re-vendors when a skill is added to the pack at the same commit", async () => {
  const { repo, commit } = fixtureRepo();
  const home = mkdtempSync(join(tmpdir(), "mack-packs-"));
  const pack = { name: "mp", description: "d", repo, commit, skills: ["skills/tdd"] };
  await vendorPack(home, pack);

  const dir = await vendorPack(home, { ...pack, skills: ["skills/tdd", "skills/grilling"] });
  expect(existsSync(join(dir, "grilling", "SKILL.md"))).toBe(true);
});

test("Factory sandboxes get every Matt Pocock skill, setup included", async () => {
  const { skillMounts } = await import("../src/factory/sandcastle.runner.js");
  const { repo, commit } = fixtureRepo();
  const home = mkdtempSync(join(tmpdir(), "mack-packs-"));
  const a = await vendorPack(home, { name: "a", description: "d", repo, commit, skills: ["skills/tdd"] });
  const b = await vendorPack(home, { name: "b", description: "d", repo, commit, skills: ["skills/grilling"] });
  expect(skillMounts([a, b]).map((m) => m.sandboxPath)).toEqual(["/home/agent/.claude/skills/tdd", "/home/agent/.claude/skills/grilling"]);

  const engineering = loadPacks(join(PROJECT_ROOT, "packs")).get("matt-pocock-engineering")!;
  expect(engineering.skills).toContain("skills/engineering/setup-matt-pocock-skills");
});

test("fails loudly when a listed skill is missing upstream", async () => {
  const { repo, commit } = fixtureRepo();
  const home = mkdtempSync(join(tmpdir(), "mack-packs-"));
  await expect(vendorPack(home, { name: "mp", description: "d", repo, commit, skills: ["skills/ghost"] })).rejects.toThrow(/no SKILL.md/);
});

test("shipped packs pin Matt Pocock's skills repo", () => {
  const packs = loadPacks(join(PROJECT_ROOT, "packs"));
  expect([...packs.keys()].sort()).toEqual(["matt-pocock-engineering", "matt-pocock-thinking"]);
  for (const p of packs.values()) expect(p.repo).toBe("https://github.com/mattpocock/skills.git");
  expect(packs.get("matt-pocock-engineering")!.skills.includes("skills/engineering/tdd")).toBeTruthy();
});
