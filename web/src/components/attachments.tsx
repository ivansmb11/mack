import { useQuery } from "@tanstack/react-query";
import { FileText, ImageOff, X } from "lucide-react";
import { toast } from "sonner";
import { type PendingAttachment, fetchAttachment, formatBytes } from "@/lib/attachments";
import type { ChatAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

function FileChip({ name, detail, onClick, onRemove }: { name: string; detail?: string; onClick?: () => void; onRemove?: () => void }) {
  return (
    <span className="bg-background flex max-w-60 items-center gap-2 rounded-lg border py-1.5 pr-2 pl-2.5 text-sm">
      <FileText className="text-muted-foreground size-4 shrink-0" />
      <button type="button" onClick={onClick} disabled={!onClick} className="min-w-0 text-left enabled:hover:underline">
        <span className="block truncate">{name}</span>
        {detail && <span className="text-muted-foreground block text-xs">{detail}</span>}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${name}`} className="text-muted-foreground hover:text-foreground ml-auto">
          <X className="size-3.5" />
        </button>
      )}
    </span>
  );
}

/** What's about to be sent, above the composer (removable) or inside the live turn's bubble (read-only). */
export function PendingAttachments({ items, onRemove, className }: { items: PendingAttachment[]; onRemove?: (id: string) => void; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((a) =>
        a.preview ? (
          <span key={a.id} className="relative">
            <img src={a.preview} alt={a.name} className="size-16 rounded-lg border object-cover" />
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                aria-label={`Quitar ${a.name}`}
                className="bg-background absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ) : (
          <FileChip key={a.id} name={a.name} detail={formatBytes(a.size)} onRemove={onRemove && (() => onRemove(a.id))} />
        ),
      )}
    </div>
  );
}

function StoredImage({ bot, path }: { bot: string; path: string }) {
  const image = useQuery({
    queryKey: ["attachment", bot, path],
    queryFn: async () => URL.createObjectURL(await fetchAttachment(bot, path)),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  });
  if (image.isError)
    return (
      <span className="text-muted-foreground flex size-24 items-center justify-center rounded-lg border" title={image.error.message}>
        <ImageOff className="size-5" />
      </span>
    );
  if (!image.data) return <span className="bg-muted block size-24 animate-pulse rounded-lg" />;
  return (
    <a href={image.data} target="_blank" rel="noreferrer">
      <img src={image.data} alt="Imagen adjunta" className="max-h-64 max-w-full rounded-lg border object-contain" />
    </a>
  );
}

async function download(bot: string, attachment: ChatAttachment) {
  try {
    const url = URL.createObjectURL(await fetchAttachment(bot, attachment.path));
    const link = Object.assign(document.createElement("a"), { href: url, download: attachment.name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (err) {
    toast.error((err as Error).message);
  }
}

export function MessageAttachments({ bot, items }: { bot: string; items: ChatAttachment[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {items.map((a) =>
        a.kind === "image" ? <StoredImage key={a.path} bot={bot} path={a.path} /> : <FileChip key={a.path} name={a.name} onClick={() => download(bot, a)} />,
      )}
    </div>
  );
}
