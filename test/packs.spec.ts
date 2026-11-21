
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
  expect(readFileSync(join(dir, ".commit"), "utf8").trim()).toBe(commit);

  await vendorPack(home, { ...pack, repo: "/does/not/exist" });
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
