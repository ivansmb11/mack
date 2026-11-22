import type { Response } from "express";

export type SseSend = (event: string, data: unknown) => void;

/** Opens an SSE response. Writes after the client leaves are dropped so the work behind it can finish. */
export function openSse(res: Response): SseSend {
  res.status(200);
  res.setHeader("content-type", "text/event-stream; charset=utf-8");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("x-accel-buffering", "no");
  res.flushHeaders();
  return (event, data) => {
    if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

export interface SseEvent {
  event: string;
  data: string;
}

/** Splits an SSE byte stream into events; yields the raw chunks too so a proxy can forward them untouched. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<{ chunk: Uint8Array; events: SseEvent[] }> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    const events = blocks.map((block) => {
      const lines = block.split("\n");
      return {
        event: lines.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message",
        data: lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join(""),
      };
    });
    yield { chunk, events };
  }
}
