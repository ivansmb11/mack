import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads what Hermes' cron scheduler leaves in a profile: cron/jobs.json and one Markdown document per run at
 * cron/output/<job>/<YYYY-MM-DD_HH-MM-SS>.md. Read from disk so a parked bot's history still shows.
 */

export interface RoutineRun {
  /** The run document's file stem; unique within its routine. */
  id: string;
  at: string;
  output: string;
  failed: boolean;
}

export interface RoutinePost extends RoutineRun {
  routine: { id: string; name: string };
}

const RUN_FILE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/;
const JOB_ID = /^[a-f0-9]{12}$/;

/** Mirrors Hermes' cron/scheduler_prompt.py: run docs are length-framed so quoted headings can't be mistaken for boundaries. */
const PROMPT_FRAME = /^\*\*Prompt Characters:\*\* (\d+)\n## Prompt\n\n/m;
const RESPONSE_FRAME = /^\*\*Response Characters:\*\* (\d+)\n## Response\n\n/;
const RUN_HEADER = /^(# Cron Job: .*|\*\*(Job ID|Run Time|Status|Mode):\*\* .*)\n+/gm;
/** Hermes suppresses delivery when the whole answer, or its first or last line, is one of these. */
const SILENCE = /^\[?(silent|no[_ ]reply)\]?$|^\(No response generated\)$/i;

/** The answer a person should read from one run document; null when the routine chose to stay silent. */
export function parseRunDocument(doc: string): { output: string; failed: boolean } | null {
  if (/\(FAILED\)\s*$/.test(doc.split("\n", 1)[0]) || /^\*\*Status:\*\* BLOCKED/m.test(doc.split("## Prompt", 1)[0])) {
    return { output: doc.replace(RUN_HEADER, "").trim(), failed: true };
  }

  let answer: string;
  const prompt = PROMPT_FRAME.exec(doc);
  if (prompt) {
    // Frame lengths count Python code points, not UTF-16 units, so emoji in the prompt would shift a plain slice.
    const afterPrompt = Array.from(doc.slice(prompt.index + prompt[0].length)).slice(Number(prompt[1]) + 2).join("");
    const response = RESPONSE_FRAME.exec(afterPrompt);
    if (!response) return { output: doc.trim(), failed: true };
    answer = afterPrompt.slice(response[0].length);
  } else if (doc.includes("## Response")) {
    answer = doc.slice(doc.lastIndexOf("## Response") + "## Response".length);
  } else {
    answer = doc;
  }

  answer = answer.trim();
  const lines = answer.split("\n").map((l) => l.trim());
  if (!answer || [answer, lines[0], lines.at(-1)!].some((l) => SILENCE.test(l))) return null;
  return { output: answer, failed: false };
}

function readJobNames(profileDir: string): Map<string, string> {
  try {
    const raw = JSON.parse(readFileSync(join(profileDir, "cron", "jobs.json"), "utf8")) as unknown;
    const jobs = (Array.isArray(raw) ? raw : (raw as { jobs?: unknown[] }).jobs ?? []) as { id?: string; name?: string }[];
    return new Map(jobs.filter((j) => j.id).map((j) => [j.id!, j.name || "Rutina"]));
  } catch {
    return new Map();
  }
}

/** Newest first. Silent runs are left out: there was nothing to say. */
export function readRuns(profileDir: string, jobId: string, limit = 20): RoutineRun[] {
  const dir = join(profileDir, "cron", "output", jobId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => RUN_FILE.test(f))
    .sort()
    .reverse()
    .slice(0, limit)
    .flatMap((f) => {
      const path = join(dir, f);
      const parsed = parseRunDocument(readFileSync(path, "utf8"));
      // The file name is Hermes-local time with no zone; the mtime is unambiguous.
      return parsed ? [{ id: f.slice(0, -3), at: statSync(path).mtime.toISOString(), ...parsed }] : [];
    });
}

/** Every routine's recent results, as posts for the bot's chat, oldest first. */
export function readRoutinePosts(profileDir: string, perRoutine = 20): RoutinePost[] {
  const root = join(profileDir, "cron", "output");
  if (!existsSync(root)) return [];
  const names = readJobNames(profileDir);
  return readdirSync(root)
    .filter((d) => JOB_ID.test(d))
    .flatMap((job) =>
      readRuns(profileDir, job, perRoutine).map((run) => ({ ...run, routine: { id: job, name: names.get(job) ?? "Rutina" } })),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
}
