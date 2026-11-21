import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PROJECT_ROOT } from "../src/config.ts";
import { loadPacks, vendorPack } from "../src/packs.ts";

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
  assert.ok(existsSync(join(dir, "tdd", "SKILL.md")));
  assert.ok(existsSync(join(dir, "grilling", "SKILL.md")));
  assert.ok(!existsSync(join(dir, "unused")));
  assert.equal(readFileSync(join(dir, ".commit"), "utf8").trim(), commit);

  await vendorPack(home, { ...pack, repo: "/does/not/exist" });
});

test("fails loudly when a listed skill is missing upstream", async () => {
  const { repo, commit } = fixtureRepo();
  const home = mkdtempSync(join(tmpdir(), "mack-packs-"));
  await assert.rejects(vendorPack(home, { name: "mp", description: "d", repo, commit, skills: ["skills/ghost"] }), /no SKILL.md/);
});

test("shipped packs pin Matt Pocock's skills repo", () => {
  const packs = loadPacks(join(PROJECT_ROOT, "packs"));
  assert.deepEqual([...packs.keys()].sort(), ["matt-pocock-engineering", "matt-pocock-thinking"]);
  for (const p of packs.values()) assert.equal(p.repo, "https://github.com/mattpocock/skills.git");
  assert.ok(packs.get("matt-pocock-engineering")!.skills.includes("skills/engineering/tdd"));
});
