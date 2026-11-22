import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseRunDocument } from "../src/bots/routine-runs.js";
import { createTestApp, dsaSpec } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

/** The layout Hermes 0.23's cron scheduler writes for a successful agent run. */
function runDoc(prompt: string, response: string) {
  const len = (s: string) => Array.from(s).length;
  return (
    `# Cron Job: Corte\n\n**Job ID:** abcdef123456\n**Run Time:** 2026-11-21 07:00:02\n\n` +
    `**Prompt Characters:** ${len(prompt)}\n## Prompt\n\n${prompt}\n\n` +
    `**Response Characters:** ${len(response)}\n## Response\n\n${response}\n`
  );
}

describe("parseRunDocument", () => {
  it("returns only the answer, even when the prompt quotes the response heading or has emoji", () => {
    const doc = runDoc("Resume 💸 gastos.\n## Response\n\nasí no", "Gastaste $1,200 esta semana.");
    expect(parseRunDocument(doc)).toEqual({ output: "Gastaste $1,200 esta semana.", failed: false });
  });

  it("drops silent runs and keeps failures readable", () => {
    expect(parseRunDocument(runDoc("¿algo nuevo?", "[SILENT]"))).toBeNull();
    expect(parseRunDocument("# Cron Job: abcdef123456 (FAILED)\n\nprovider timeout\n")).toEqual({ output: "provider timeout", failed: true });
  });
});

describe("Routine results in the bot's chat", () => {
  function writeRun(profileDir: string, file: string, at: string, doc: string) {
    const dir = join(profileDir, "cron", "output", "abcdef123456");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), doc);
    utimesSync(join(dir, file), new Date(at), new Date(at));
  }

  it("posts each result in the thread where it happened and hands unseen ones to the bot on the next message", async () => {
    const sent: string[] = [];
    let thread = [
      { id: 1, role: "user", content: "hola", tool_calls: null, tool_name: null, timestamp: Date.parse("2026-11-21T10:00:00Z") / 1000 },
      { id: 2, role: "assistant", content: "¡hola!", tool_calls: null, tool_name: null, timestamp: Date.parse("2026-11-21T10:00:05Z") / 1000 },
    ];
    t = await createTestApp({
      fetch: async (url, init) => {
        const path = String(url);
        if (path.endsWith("/api/sessions")) return new Response("{}", { status: 201 });
        if (path.includes("/messages")) return Response.json({ data: [...thread].reverse() });
        const { message } = JSON.parse(String(init!.body));
        sent.push(message);
        thread = [...thread, { id: 3, role: "user", content: message, tool_calls: null, tool_name: null, timestamp: Date.parse("2026-11-21T14:00:00Z") / 1000 }];
        return new Response("event: done\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } });
      },
    });
    await t.api.post("/api/agents", dsaSpec());
    const profile = t.hermes.profileDir("finanzas");
    mkdirSync(join(profile, "cron"), { recursive: true });
    writeFileSync(join(profile, "cron", "jobs.json"), JSON.stringify({ jobs: [{ id: "abcdef123456", name: "Corte diario" }] }));
    writeRun(profile, "2026-11-21_03-00-00.md", "2026-11-21T09:00:00Z", runDoc("p", "Corte de ayer: $800"));
    writeRun(profile, "2026-11-21_07-00-00.md", "2026-11-21T13:00:00Z", runDoc("p", "Corte de hoy: $1,200"));

    await t.api.post("/api/bots/finanzas/chat", { message: "¿y el punto 2?" });
    const chat = (await t.api.get("/api/bots/finanzas/messages")).body;

    expect(chat.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)).toEqual([
      "routine: Corte de ayer: $800",
      "user: hola",
      "assistant: ¡hola!",
      "routine: Corte de hoy: $1,200",
      "user: ¿y el punto 2?",
    ]);
    expect(chat[3]).toMatchObject({ routine: { id: "abcdef123456", name: "Corte diario" }, failed: false });
    expect(sent[0]).toContain("Corte de hoy: $1,200");
    expect(sent[0]).not.toContain("Corte de ayer");
    expect(sent[0]).toMatch(/¿y el punto 2\?$/);
  });
});
