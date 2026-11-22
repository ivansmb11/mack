import { ApiError, tokenStore } from "@/lib/api";

export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** POSTs to an SSE endpoint of the control plane and yields its named events. */
export async function* postSse(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const res = await fetch(path, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${tokenStore.get() ?? ""}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    const message = (() => {
      try {
        return JSON.parse(text).message as string;
      } catch {
        return text;
      }
    })();
    throw new ApiError(res.status, res.status === 402 ? `Presupuesto agotado: ${message}` : message || `Error ${res.status}`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const lines = block.split("\n");
      const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
      const data = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (data) yield { event, data: JSON.parse(data) };
    }
  }
}
