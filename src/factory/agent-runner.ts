/** Everything one Sandcastle execution needs; the runner holds no Mack state. */
export interface JobRun {
  id: string;
  repo: string;
  branch: string;
  baseBranch: string;
  model: string;
  maxIterations: number;
  setupCommand?: string;
  imageName: string;
  /** Vendored pack directories; each skill folder inside them is mounted at ~/.claude/skills/<skill>. */
  skillsDirs: string[];
  /** Absolute paths; Sandcastle fills their {{KEY}} placeholders from promptArgs (inline prompts are not templated). */
  promptFiles: { implement: string; review: string | null };
  promptArgs: Record<string, string>;
}

export interface RunnerResult {
  commits: string[];
  completed: boolean;
  output: string;
}

export type AgentRunner = (run: JobRun) => Promise<RunnerResult>;

export const AGENT_RUNNER = Symbol("AGENT_RUNNER");
