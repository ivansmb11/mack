import { tokenStore } from "@/lib/api";

export const MAX_ATTACHMENTS = 8;
const MAX_BYTES = 20 * 1024 * 1024;
/** Claude downsizes anything larger, so sending more pixels only costs upload time. */
const MAX_IMAGE_SIDE = 1568;
const RESIZABLE = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface PendingAttachment {
  id: string;
  name: string;
  type: string;
  /** Base64 without the data: prefix, as the chat endpoint takes it. */
  data: string;
  size: number;
  /** Object URL for a thumbnail; revoke when the attachment is dropped. */
  preview?: string;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: file.type === "image/png" ? "image/png" : "image/jpeg", quality: 0.85 });
}

/** Reads a picked, pasted or dropped file into what the chat sends. Throws a message meant for Iván. */
export async function prepareAttachment(file: File): Promise<PendingAttachment> {
  const type = file.type || "application/octet-stream";
  const blob = RESIZABLE.has(type) ? await shrinkImage(file).catch(() => file) : file;
  if (blob.size > MAX_BYTES) throw new Error(`${file.name} pesa más de 20 MB.`);
  return {
    id: crypto.randomUUID(),
    name: file.name || "pegado.png",
    type: blob.type || type,
    data: await toBase64(blob),
    size: blob.size,
    preview: type.startsWith("image/") ? URL.createObjectURL(blob) : undefined,
  };
}

/** Attachments need the bearer token, so they're fetched as blobs instead of linked directly. */
export async function fetchAttachment(bot: string, path: string): Promise<Blob> {
  const res = await fetch(`/api/bots/${bot}/attachments?path=${encodeURIComponent(path)}`, {
    headers: { authorization: `Bearer ${tokenStore.get() ?? ""}` },
  });
  if (!res.ok) throw new Error(res.status === 404 ? "Ese adjunto ya no existe." : `No pude abrir el adjunto (${res.status}).`);
  return res.blob();
}

export const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
