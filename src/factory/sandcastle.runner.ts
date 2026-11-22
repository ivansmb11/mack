import { readdirSync } from "node:fs";
import { join } from "node:path";
import { claudeCode, createSandbox } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import type { AgentRunner } from "./agent-runner.js";

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

/**
 * Runs a Factory job as Sandcastle's sequential-reviewer pattern: implement, then (optionally)
 * review in the same long-lived sandbox so commits and installed deps carry over.
 */
export function sandcastleRunner(agentEnv: Record<string, string>): AgentRunner {
  return async (job) => {
    const sandbox = await createSandbox({
      branch: job.branch,
      baseBranch: job.baseBranch,
      cwd: job.repo,
      sandbox: docker({
        imageName: job.imageName,
        mounts: skillMounts(job.skillsDirs),
      }),
      ...(job.setupCommand ? { hooks: { sandbox: { onSandboxReady: [{ command: job.setupCommand }] } } } : {}),
    });
    try {
      const agent = claudeCode(job.model, { env: agentEnv });
      const implement = await sandbox.run({
        agent,
        name: `${job.id}:implement`,
        promptFile: job.promptFiles.implement,
        promptArgs: job.promptArgs,
        maxIterations: job.maxIterations,
        completionSignal: COMPLETE,
      });
      const review = job.promptFiles.review
        ? await sandbox.run({
            agent,
            name: `${job.id}:review`,
            promptFile: job.promptFiles.review,
            promptArgs: job.promptArgs,
            completionSignal: COMPLETE,
          })
        : null;

      return {
        commits: [...implement.commits, ...(review?.commits ?? [])].map((c) => c.sha),
        completed: Boolean(implement.completionSignal) && (review === null || Boolean(review.completionSignal)),
        output: [implement.stdout, review?.stdout].filter(Boolean).join("\n\n--- review ---\n\n"),
      };
    } finally {
      await sandbox.close();
    }
  };
}

/** Claude Code inside the sandbox authenticates with the Max subscription token when present, else the API key. */
export function claudeAgentEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  if (env.CLAUDE_CODE_OAUTH_TOKEN) return { CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN };
  if (env.ANTHROPIC_API_KEY) return { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
  return {};
}
