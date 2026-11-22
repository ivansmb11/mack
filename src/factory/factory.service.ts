import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from "@nestjs/common";
import { type MackConfig, MACK_CONFIG, PROJECT_ROOT } from "../config/config.js";
import type { FactoryJob, JobStatus } from "../generated/prisma/client.js";
import { PacksService } from "../packs/packs.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AGENT_RUNNER, type AgentRunner } from "./agent-runner.js";
import type { JobSpec } from "./factory.schemas.js";

const OUTPUT_TAIL_CHARS = 4_000;

export type Job = Omit<FactoryJob, "commits" | "workflow"> & { commits: string[]; workflow: JobSpec["workflow"] };

const toJob = ({ commits, workflow, ...job }: FactoryJob): Job => ({
  ...job,
  commits: commits as string[],
  workflow: workflow === "implement_review" ? "implement-review" : "implement",
});

const promptFile = (name: string) => join(PROJECT_ROOT, "factory/prompts", `${name}.md`);
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();

function gitToplevel(path: string): string | null {
  try {
    return git(path, "rev-parse", "--show-toplevel");
  } catch {
    return null;
  }
}

/**
 * Factory: a persistent queue of AFK coding agents run through Sandcastle, one Docker sandbox and one
 * branch per job. Jobs never push and never move the repo's checked-out branch; merging is left to Iván.
 */
@Injectable()
export class FactoryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FactoryService.name);
  private readonly inFlight = new Set<Promise<void>>();
  private active = 0;
  private pumping = false;
  private repump = false;
  private readonly factoryConfig: MackConfig["factory"];
  private readonly roots: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly packs: PacksService,
    @Inject(AGENT_RUNNER) private readonly runner: AgentRunner,
    @Inject(MACK_CONFIG) config: MackConfig,
  ) {
    this.factoryConfig = config.factory;
    this.roots = config.factory.repoRoots.filter(existsSync).map((r) => realpathSync(r));
  }

  async onApplicationBootstrap() {
    await this.prisma.factoryJob.updateMany({
      where: { status: "running" },
      data: { status: "failed", error: "interrupted by control plane restart", finishedAt: new Date() },
    });
    this.pump();
  }

  async submit(spec: JobSpec): Promise<Job> {
    const repo = this.resolveRepo(spec.repo);
    const id = `job-${randomBytes(4).toString("hex")}`;
    this.excludeSandcastleArtifacts(repo);
    const job = await this.prisma.factoryJob.create({
      data: {
        id,
        repo,
        branch: spec.branch ?? `mack/${id}`,
        baseBranch: spec.baseBranch ?? git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        workflow: spec.workflow === "implement-review" ? "implement_review" : "implement",
        model: spec.model ?? this.factoryConfig.defaultModel,
        task: spec.task,
        maxIterations: spec.maxIterations,
        setupCommand: spec.setupCommand,
      },
    });
    this.pump();
    return toJob(job);
  }

  async get(id: string): Promise<Job> {
    const job = await this.prisma.factoryJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Job "${id}" not found`);
    return toJob(job);
  }

  async list(limit = 50): Promise<Job[]> {
    return (await this.prisma.factoryJob.findMany({ orderBy: { createdAt: "desc" }, take: limit })).map(toJob);
  }

  /** Resolves once every queued and running job has finished. */
  async drain(): Promise<void> {
    while (this.inFlight.size) await Promise.all(this.inFlight);
  }

  /** Claims as many queued jobs as there are free slots; re-runs if called again while claiming. */
  private pump(): void {
    if (this.pumping) {
      this.repump = true;
      return;
    }
    this.pumping = true;
    this.track(
      (async () => {
        do {
          this.repump = false;
          const free = this.factoryConfig.maxConcurrent - this.active;
          if (free <= 0) break;
          for (const job of await this.claimNext(free)) {
            this.active++;
            this.track(this.execute(job).finally(() => (this.active--, this.pump())));
          }
        } while (this.repump);
      })()
        .catch((err) => this.logger.error(`Factory queue error: ${err}`))
        .finally(() => (this.pumping = false)),
    );
  }

  private track(p: Promise<unknown>): void {
    const tracked = p.then(() => undefined);
    this.inFlight.add(tracked);
    void tracked.finally(() => this.inFlight.delete(tracked));
  }

  private claimNext(limit: number): Promise<FactoryJob[]> {
    return this.prisma.$transaction(async (tx) => {
      const queued = await tx.factoryJob.findMany({ where: { status: "queued" }, orderBy: { createdAt: "asc" }, take: limit });
      await tx.factoryJob.updateMany({
        where: { id: { in: queued.map((j) => j.id) } },
        data: { status: "running", startedAt: new Date() },
      });
      return queued;
    });
  }

  private async execute(job: FactoryJob): Promise<void> {
    try {
      const result = await this.runner({
        id: job.id,
        repo: job.repo,
        branch: job.branch,
        baseBranch: job.baseBranch,
        model: job.model,
        maxIterations: job.maxIterations,
        setupCommand: job.setupCommand ?? undefined,
        imageName: this.factoryConfig.imageName,
        skillsDirs: await Promise.all(this.packs.resolve(this.factoryConfig.skillPacks).map((p) => this.packs.vendor(p))),
        promptFiles: { implement: promptFile("implement"), review: job.workflow === "implement_review" ? promptFile("review") : null },
        promptArgs: { TASK: job.task, BRANCH: job.branch, BASE: job.baseBranch },
      });
      await this.finish(job.id, result.completed ? "done" : "incomplete", { commits: result.commits, output: result.output });
    } catch (err) {
      await this.finish(job.id, "failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async finish(id: string, status: JobStatus, fields: { commits?: string[]; output?: string; error?: string }) {
    await this.prisma.factoryJob.update({
      where: { id },
      data: {
        status,
        commits: fields.commits ?? [],
        output: fields.output?.slice(-OUTPUT_TAIL_CHARS) ?? null,
        error: fields.error ?? null,
        finishedAt: new Date(),
      },
    });
  }

  private resolveRepo(input: string): string {
    const candidate = resolve(input.replace(/^~(?=\/)/, homedir()));
    if (!existsSync(candidate)) throw new BadRequestException(`Repo ${candidate} does not exist`);
    const path = realpathSync(candidate);
    if (!this.roots.some((root) => path === root || path.startsWith(root + sep)))
      throw new BadRequestException(`Repo ${path} is outside factory.repoRoots (${this.roots.join(", ")})`);
    if (gitToplevel(path) !== path) throw new BadRequestException(`${path} is not the root of a git repo`);
    return path;
  }

  /** Sandcastle keeps worktrees and logs in <repo>/.sandcastle; hide them locally without touching tracked files. */
  private excludeSandcastleArtifacts(repo: string) {
    const exclude = resolve(repo, git(repo, "rev-parse", "--git-path", "info/exclude"));
    const current = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
    if (!current.split("\n").includes(".sandcastle/"))
      appendFileSync(exclude, `${current && !current.endsWith("\n") ? "\n" : ""}.sandcastle/\n`);
  }
}
