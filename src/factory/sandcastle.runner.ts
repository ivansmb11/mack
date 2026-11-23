import { readdirSync } from "node:fs";
import { join } from "node:path";
import { type AgentStreamEvent, claudeCode, createSandbox, type Sandbox } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import type { AgentRunner, JobRun, JobStep } from "./agent-runner.js";

const COMPLETE = "<promise>COMPLETE</promise>";
const SANDBOX_SKILLS = "/home/agent/.claude/skills";

/** One read-only mount per skill, so several packs land side by side in the sandbox's skills directory. */
export function skillMounts(packDirs: string[]) {
  return packDirs.flatMap((dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ hostPath: join(dir, entry.name), sandboxPath: `${SANDBOX_SKILLS}/${entry.name}`, readonly: true })),
  );
}

/** Maps Sandcastle's agent stream to timeline steps; raw stdout lines are dropped because the parsed events already cover them. */
export function stepFromStreamEvent(phase: string, event: AgentStreamEvent): JobStep | null {
  if (event.type === "toolCall") return { phase, kind: "tool", text: `${event.name}(${event.formattedArgs})`, at: event.timestamp };
  if (event.type === "text") return { phase, kind: "text", text: event.message, at: event.timestamp };
  return null;
}

/**
 * Runs a Factory job as Sandcastle's sequential-reviewer pattern: implement, then (optionally)
 * review in the same long-lived sandbox so commits and installed deps carry over.
 *
 * Secrets go in `sandboxEnv`, which Docker receives as `-e` flags. Sandcastle inlines an agent's own
 * env as `export K=V;` in the exec command, which would expose them in the container's `ps`.
 */
export function sandcastleRunner(sandboxEnv: Record<string, string>): AgentRunner {
  return async (job) => {
    const status = (phase: string, text: string) => job.onStep({ phase, kind: "status", text, at: new Date() });

    status("setup", `Levantando sandbox ${job.imageName} en ${job.branch} desde ${job.baseBranch}`);
    const sandbox = await createSandbox({
      branch: job.branch,
      baseBranch: job.baseBranch,
      cwd: job.repo,
      sandbox: docker({ imageName: job.imageName, mounts: skillMounts(job.skillsDirs), env: sandboxEnv }),
      ...(job.setupCommand ? { hooks: { sandbox: { onSandboxReady: [{ command: job.setupCommand }] } } } : {}),
    });
    status("setup", job.setupCommand ? `Sandbox listo; corrió \`${job.setupCommand}\`` : "Sandbox listo");
    try {
      const agent = claudeCode(job.model);
      const implement = await runPhase(sandbox, job, agent, "implement", job.promptFiles.implement, job.maxIterations);
      const review = job.promptFiles.review ? await runPhase(sandbox, job, agent, "review", job.promptFiles.review, 1) : null;

      return {
        commits: [...implement.commits, ...(review?.commits ?? [])].map((c) => c.sha),
        completed: Boolean(implement.completionSignal) && (review === null || Boolean(review.completionSignal)),
        output: [implement.stdout, review?.stdout].filter(Boolean).join("\n\n--- review ---\n\n"),
      };
    } finally {
      status("teardown", "Cerrando sandbox");
      await sandbox.close();
    }
  };
}

async function runPhase(sandbox: Sandbox, job: JobRun, agent: ReturnType<typeof claudeCode>, phase: string, promptFile: string, maxIterations: number) {
  job.onStep({ phase, kind: "status", text: `Empieza ${phase} (máx. ${maxIterations} ${maxIterations === 1 ? "iteración" : "iteraciones"})`, at: new Date() });
  const result = await sandbox.run({
    agent,
    name: `${job.id}:${phase}`,
    promptFile,
    promptArgs: job.promptArgs,
    maxIterations,
    completionSignal: COMPLETE,
    logging: {
      type: "file",
      path: join(job.repo, ".sandcastle", "logs", `${job.id}-${phase}.log`),
      onAgentStreamEvent: (event) => {
        const step = stepFromStreamEvent(phase, event);
        if (step) job.onStep(step);
      },
    },
  });
  const signal = result.completionSignal ? "con señal COMPLETE" : "sin señal COMPLETE";
  job.onStep({ phase, kind: "status", text: `Terminó ${phase}: ${result.commits.length} commits, ${signal}`, at: new Date() });
  return result;
}

/**
 * Secrets for the sandbox: Claude Code auth (Max subscription token when present, else the API key)
 * and, when FACTORY_GH_TOKEN is set, a GitHub token so the agent can read tickets with `gh`.
 */
export function sandboxSecrets(env: NodeJS.ProcessEnv): Record<string, string> {
  const secrets: Record<string, string> = {};
  if (env.CLAUDE_CODE_OAUTH_TOKEN) secrets.CLAUDE_CODE_OAUTH_TOKEN = env.CLAUDE_CODE_OAUTH_TOKEN;
  else if (env.ANTHROPIC_API_KEY) secrets.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (env.FACTORY_GH_TOKEN) secrets.GH_TOKEN = env.FACTORY_GH_TOKEN;
  return secrets;
}
