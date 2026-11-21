import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { JobRun } from "../src/factory/agent-runner.js";
import { FactoryService } from "../src/factory/factory.service.js";
import { createTestApp } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

function gitRepo(parent: string, name = "app"): string {
  const repo = join(parent, name);
  mkdirSync(repo);
  const g = (...args: string[]) => execFileSync("git", args, { cwd: repo });
  g("init", "-q", "-b", "main");
  writeFileSync(join(repo, "README.md"), "hi\n");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  return realpathSync(repo);
}

describe("Factory", () => {
  it("runs a job through the runner with Matt Pocock prompts and records the result", async () => {
    const runs: JobRun[] = [];
    t = await createTestApp({
      runner: async (run) => (runs.push(run), { commits: ["abc123"], completed: true, output: "resumen\n<promise>COMPLETE</promise>" }),
    });
    const repo = gitRepo(t.repos);

    const res = await t.api.post("/api/factory/jobs", { repo, task: "Agrega un endpoint /ping con tests" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "queued", workflow: "implement-review", baseBranch: "main", model: "claude-test" });
    expect(res.body.branch).toBe(`mack/${res.body.id}`);

    await t.get<FactoryService>(FactoryService).drain();

    const job = (await t.api.get(`/api/factory/jobs/${res.body.id}`)).body;
    expect(job).toMatchObject({ status: "done", commits: ["abc123"] });
    expect(runs[0]).toMatchObject({ repo, imageName: "sandcastle:test", skillsDir: join(t.root, "packs", "demo"), maxIterations: 5 });
    expect(readFileSync(runs[0].promptFiles.implement, "utf8")).toMatch(/skill `tdd`/);
    expect(readFileSync(runs[0].promptFiles.review!, "utf8")).toMatch(/skill `code-review`/);
    expect(runs[0].promptArgs).toEqual({ TASK: "Agrega un endpoint /ping con tests", BRANCH: job.branch, BASE: "main" });
    expect(readFileSync(join(repo, ".git/info/exclude"), "utf8")).toContain(".sandcastle/\n");
  });

  it("respects maxConcurrent and marks incomplete and failed runs", async () => {
    let running = 0;
    let peak = 0;
    t = await createTestApp({
      maxConcurrent: 2,
      runner: async (run) => {
        peak = Math.max(peak, ++running);
        await new Promise((r) => setTimeout(r, 20));
        running--;
        if (run.promptArgs.TASK.includes("boom")) throw new Error("docker exploded");
        return { commits: [], completed: !run.promptArgs.TASK.includes("slow"), output: "" };
      },
    });
    const repo = gitRepo(t.repos);
    const tasks = ["tarea uno ok", "tarea dos slow", "tarea tres boom", "tarea cuatro ok"];
    const ids = [];
    for (const task of tasks) ids.push((await t.api.post("/api/factory/jobs", { repo, task, workflow: "implement" })).body.id);

    await t.get<FactoryService>(FactoryService).drain();

    expect(peak).toBe(2);
    const statuses = await Promise.all(ids.map(async (id) => (await t.api.get(`/api/factory/jobs/${id}`)).body));
    expect(statuses.map((j) => j.status)).toEqual(["done", "incomplete", "failed", "done"]);
    expect(statuses[2].error).toBe("docker exploded");
  });

  it("only accepts git repo roots under factory.repoRoots", async () => {
    t = await createTestApp();
    const outside = gitRepo(t.root, "outside");
    const notRepo = join(t.repos, "plain");
    mkdirSync(notRepo);
    const repo = gitRepo(t.repos);
    mkdirSync(join(repo, "sub"));

    for (const path of [outside, notRepo, join(repo, "sub"), join(t.repos, "missing")])
      expect((await t.api.post("/api/factory/jobs", { repo: path, task: "una tarea cualquiera" })).status).toBe(400);
    expect((await t.api.post("/api/factory/jobs", { repo, task: "corta" })).status).toBe(400);
  });
});
