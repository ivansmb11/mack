import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, dsaSpec } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const auth = { authorization: `Bearer ${"t".repeat(64)}` };

describe("Chat attachments", () => {
  async function setup() {
    const sent: unknown[] = [];
    const stored: { id: number; role: string; content: string; tool_calls: null; tool_name: null; timestamp: number }[] = [];
    t = await createTestApp({
      fetch: async (url, init) => {
        const path = String(url);
        if (path.endsWith("/api/sessions")) return new Response("{}", { status: 201 });
        if (path.includes("/messages")) return Response.json({ data: [...stored].reverse() });
        sent.push(JSON.parse(String(init!.body)).message);
        return new Response("event: done\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } });
      },
    });
    await t.api.post("/api/agents", dsaSpec());
    return { sent, stored, docs: join(t.hermes.profileDir("finanzas"), "cache", "documents") };
  }

  it("sends images as vision parts and files as a path the bot can open", async () => {
    const { sent } = await setup();

    await t.api.post("/api/bots/finanzas/chat", {
      message: "revisa esto",
      attachments: [
        { name: "ticket.png", type: "image/png", data: PNG },
        { name: "../../estado de cuenta.csv", type: "text/csv", data: Buffer.from("fecha,monto\n1,20").toString("base64") },
      ],
    });

    const [text, image] = sent[0] as [{ type: string; text: string }, { image_url: { url: string } }];
    const filePath = text.text.match(/\[Archivo adjunto: (.+)\]/)![1];
    expect(text.text).toMatch(/^revisa esto\n\n\[Archivo adjunto: /);
    expect(filePath).toMatch(/cache\/documents\/mack-uploads\/[^/]+\/estado de cuenta\.csv$/);
    expect(readFileSync(filePath, "utf8")).toBe("fecha,monto\n1,20");
    expect(image.image_url.url).toBe(`data:image/png;base64,${PNG}`);
  });

  it("shows stored attachments apart from the text and serves only files inside the profile", async () => {
    const { sent, stored, docs } = await setup();
    await t.api.post("/api/bots/finanzas/chat", { attachments: [{ name: "notas.txt", type: "text/plain", data: Buffer.from("hola").toString("base64") }] });
    const filePath = (sent[0] as string).match(/\[Archivo adjunto: (.+)\]/)![1];
    stored.push({
      id: 1,
      role: "user",
      content: `${sent[0]}\n\n[Image attached at: ${docs}/native-inputs/abc/api_abc.png]\n[screenshot]`,
      tool_calls: null,
      tool_name: null,
      timestamp: 1,
    });

    const [message] = (await t.api.get("/api/bots/finanzas/messages")).body;
    const file = message.attachments.find((a: { kind: string }) => a.kind === "file");
    const download = await t.http.get(`/api/bots/finanzas/attachments?path=${encodeURIComponent(file.path)}`).set(auth);

    expect(message.content).toBe("");
    expect(message.attachments).toEqual([
      { kind: "file", name: "notas.txt", path: expect.stringMatching(/^mack-uploads\/.+\/notas\.txt$/) },
      { kind: "image", name: "imagen", path: "native-inputs/abc/api_abc.png" },
    ]);
    expect(filePath.endsWith(file.path)).toBe(true);
    expect(download.text).toBe("hola");
    expect((await t.http.get("/api/bots/finanzas/attachments?path=../../.env").set(auth)).status).toBe(400);
  });

  it("needs a message or an attachment", async () => {
    await setup();
    expect((await t.api.post("/api/bots/finanzas/chat", { message: "  " })).status).toBe(400);
  });
});
