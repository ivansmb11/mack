import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { z } from "zod";

/**
 * Attachments in a bot's chat. Images go to Hermes as native vision parts; Hermes stores them under the profile's
 * cache/documents and leaves an "[Image attached at: <path>]" hint in the transcript. Its session API refuses other
 * files, so Mack stores those next to them and hands the bot the path, which it reads with its own tools.
 */

const VISION_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const MAX_ATTACHMENTS = 8;
/** Base64 grows payloads by a third; main.ts sizes the JSON body limit to fit this. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const AttachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().max(200).default("application/octet-stream"),
  /** Base64 without the data: prefix. */
  data: z.string().min(1).max(Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 4),
});
export type AttachmentInput = z.output<typeof AttachmentSchema>;

export interface Attachment {
  kind: "image" | "file";
  name: string;
  /** Relative to the profile's cache/documents; what the attachment download endpoint takes. */
  path: string;
}

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

const IMAGE_HINT = /\[Image attached at: ([^\n]+)\]/g;
const FILE_HINT = /\[Archivo adjunto: ([^\n]+)\]/g;
/** Hermes may label an image ("[screenshot]") on its own line after the hints. */
const TRAILING_LABEL = /(\n\[[a-z][a-z _-]*\])+\s*$/;
const NO_TEXT = "Te adjunto esto.";

const documentsDir = (profileDir: string) => join(profileDir, "cache", "documents");

/** Keeps the name readable but unable to climb out of its folder. */
const safeName = (name: string) => basename(name).replace(/[\u0000-\u001f/\\:]/g, "_").slice(0, 120) || "archivo";

/** The `message` Hermes' session chat takes: plain text, or text plus image parts when there are images. */
export function buildTurn(profileDir: string, text: string, attachments: AttachmentInput[]): string | ContentPart[] {
  const images = attachments.filter((a) => VISION_TYPES.has(a.type));
  const files = attachments.filter((a) => !VISION_TYPES.has(a.type));

  const fileHints = files.map((file) => {
    const dir = join(documentsDir(profileDir), "mack-uploads", randomUUID());
    mkdirSync(dir, { recursive: true });
    const path = join(dir, safeName(file.name));
    writeFileSync(path, Buffer.from(file.data, "base64"));
    return `[Archivo adjunto: ${path}]`;
  });

  const body = [text.trim() || (attachments.length ? NO_TEXT : ""), fileHints.join("\n")].filter(Boolean).join("\n\n");
  if (!images.length) return body;
  return [{ type: "text", text: body }, ...images.map((i): ContentPart => ({ type: "image_url", image_url: { url: `data:${i.type};base64,${i.data}` } }))];
}

/** Splits the hints back out of a stored user message, so the chat shows the text and the attachments separately. */
export function extractAttachments(profileDir: string, content: string): { content: string; attachments: Attachment[] } {
  const docs = documentsDir(profileDir);
  const attachments: Attachment[] = [];
  const collect = (kind: Attachment["kind"]) => (_: string, path: string) => {
    const rel = relative(docs, path.trim());
    if (!rel.startsWith("..")) attachments.push({ kind, name: kind === "file" ? basename(rel) : "imagen", path: rel });
    return "";
  };
  const text = content.replace(FILE_HINT, collect("file")).replace(IMAGE_HINT, collect("image")).replace(TRAILING_LABEL, "").trim();
  return { content: text === NO_TEXT && attachments.length ? "" : text, attachments };
}

/** Absolute path of an attachment, refusing anything outside the profile's cache/documents. */
export function resolveAttachment(profileDir: string, path: string): string {
  const docs = resolve(documentsDir(profileDir));
  const absolute = resolve(docs, path);
  if (!absolute.startsWith(docs + sep)) throw new BadRequestException("Adjunto inválido");
  if (!existsSync(absolute)) throw new NotFoundException("Ese adjunto ya no existe");
  return absolute;
}
