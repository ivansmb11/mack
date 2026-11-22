import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2, Trash2, Users } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { BotAvatar, botColor, GroupAvatar } from "@/components/bot-avatar";
import { Markdown } from "@/components/markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { keys, useBots, useGroupMessages, useGroupMutations, useGroups } from "@/hooks/queries";
import { formatClock } from "@/lib/format";
import { postSse } from "@/lib/sse";
import type { Bot, Group, GroupMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const MENTION_AT_CURSOR = /@([a-z0-9-]*)$/;

function withMentions(text: string, members: string[]) {
  return text.split(/(@[a-z][a-z0-9-]{1,30})/g).map((part, i) =>
    part.startsWith("@") && members.includes(part.slice(1)) ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function MembersSheet({ group, bots, open, onOpenChange }: { group: Group; bots: Bot[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { update, remove } = useGroupMutations();
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState(group.members);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setName(group.name);
    setMembers(group.members);
  }, [group]);
  const dirty = name.trim() !== group.name || members.join() !== group.members.join();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{group.name}</SheetTitle>
          <SheetDescription>Contesta quien mencionas con @. Si no mencionas a nadie, Matrix elige al bot del tema.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Nombre</Label>
            <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <fieldset className="space-y-1">
            <legend className="mb-2 text-sm font-medium">Integrantes</legend>
            {bots.map((b) => {
              const on = members.includes(b.name);
              return (
                <label key={b.name} className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-2 py-2">
                  <BotAvatar name={b.name} avatar={b.avatar} color={b.color} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{b.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">{b.description}</span>
                  </span>
                  <Switch checked={on} onCheckedChange={(v) => setMembers(v ? [...members, b.name] : members.filter((m) => m !== b.name))} aria-label={b.name} />
                </label>
              );
            })}
          </fieldset>
        </div>
        <div className="flex gap-2 border-t p-4">
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
            <Trash2 />
            Eliminar grupo
          </Button>
          <Button
            className="ml-auto"
            disabled={!dirty || !members.length || !name.trim() || update.isPending}
            onClick={() => update.mutate({ id: group.id, name: name.trim(), members }, { onSuccess: () => onOpenChange(false) })}
          >
            Guardar
          </Button>
        </div>
      </SheetContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{group.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Se borra la conversación del grupo. Los bots y sus chats individuales no se tocan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => remove.mutate(group.id, { onSuccess: () => (window.location.hash = "/bot/mack") })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

export function GroupChatView({ id }: { id: string }) {
  const qc = useQueryClient();
  const groups = useGroups();
  const bots = useBots();
  const messages = useGroupMessages(id);
  const group = groups.data?.find((g) => g.id === id);
  const looks = Object.fromEntries((bots.data ?? []).map((b) => [b.name, { avatar: b.avatar, color: b.color }]));

  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.data, typing]);

  const mentionQuery = draft.match(MENTION_AT_CURSOR)?.[1];
  const mentionOptions = mentionQuery === undefined ? [] : (group?.members ?? []).filter((m) => m.startsWith(mentionQuery));

  function insertMention(name: string) {
    setDraft(draft.replace(MENTION_AT_CURSOR, `@${name} `));
    input.current?.focus();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setDraft("");
    setBusy(true);
    const append = (m: GroupMessage) => qc.setQueryData<GroupMessage[]>(keys.groupMessages(id), (all = []) => [...all, m]);
    try {
      for await (const { event, data } of postSse(`/api/groups/${id}/messages`, { content })) {
        if (event === "typing") setTyping(String(data.agent));
        if (event === "message") {
          append(data as unknown as GroupMessage);
          setTyping(null);
        }
      }
    } catch (err) {
      append({ id: -Date.now(), groupId: id, author: "mack", content: (err as Error).message, error: true, createdAt: new Date().toISOString() });
    } finally {
      setTyping(null);
      setBusy(false);
      qc.invalidateQueries({ queryKey: keys.groups });
      qc.invalidateQueries({ queryKey: keys.ledger });
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === "Tab" || e.key === "Enter") && mentionOptions.length) {
      e.preventDefault();
      insertMention(mentionOptions[0]);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  if (groups.isSuccess && !group)
    return <p className="text-muted-foreground m-auto">Este grupo ya no existe.</p>;

  const history = messages.data ?? [];

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="w-10" />
        {group && (
          <button onClick={() => setShowMembers(true)} className="hover:bg-accent flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 transition-colors">
            <GroupAvatar members={group.members} looks={looks} size={24} />
            <span className="truncate font-medium">{group.name}</span>
            <span className="text-muted-foreground text-xs">{group.members.length}</span>
          </button>
        )}
        <Button variant="ghost" size="icon" aria-label="Integrantes" onClick={() => setShowMembers(true)}>
          <Users />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" aria-live="polite">
        {messages.isLoading ? (
          <Skeleton className="mx-auto h-24 max-w-3xl" />
        ) : history.length === 0 && group ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-[12vh] text-center">
            <GroupAvatar members={group.members} looks={looks} size={72} />
            <div>
              <h1 className="text-2xl">{group.name}</h1>
              <p className="text-muted-foreground mt-1">
                Menciona a {group.members.map((m) => `@${m}`).join(", ")} para que contesten. Ellos se pasan el trabajo mencionándose entre sí.
              </p>
            </div>
          </div>
        ) : (
          <ol className="mx-auto max-w-3xl space-y-4">
            {history.map((m) => {
              const mine = m.author === "user";
              return (
                <li key={m.id} className={cn("flex flex-col", mine && "items-end")}>
                  {!mine && (
                    <span className="mb-1 flex items-center gap-2 text-sm font-medium" style={{ color: botColor(m.author, looks[m.author]?.color) }}>
                      <BotAvatar name={m.author} {...looks[m.author]} size={20} />
                      {m.author}
                      <span className="text-muted-foreground text-xs font-normal">{formatClock(m.createdAt)}</span>
                    </span>
                  )}
                  <div
                    className={cn(
                      "w-fit max-w-[min(68ch,85%)] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                      mine ? "bg-primary rounded-br-md whitespace-pre-wrap text-white" : "bg-secondary rounded-tl-md",
                      m.error && "text-destructive",
                    )}
                  >
                    {mine ? withMentions(m.content, group?.members ?? []) : <Markdown>{m.content}</Markdown>}
                  </div>
                </li>
              );
            })}
            {typing && (
              <li className="text-muted-foreground flex items-center gap-2 text-sm">
                <BotAvatar name={typing} {...looks[typing]} state="thinking" size={20} />
                {typing} está escribiendo
                <Loader2 className="size-3.5 animate-spin" />
              </li>
            )}
          </ol>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={onSubmit} className="relative px-4 pt-1 pb-4">
        {mentionOptions.length > 0 && (
          <div className="bg-popover absolute bottom-full left-1/2 mb-1 w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border p-1 shadow-lg" role="listbox">
            {mentionOptions.map((m, i) => (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={i === 0}
                onClick={() => insertMention(m)}
                className={cn("hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", i === 0 && "bg-accent")}
              >
                <BotAvatar name={m} {...looks[m]} size={20} />@{m}
              </button>
            ))}
          </div>
        )}
        <div className="bg-card focus-within:ring-ring/50 mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border p-1.5 pl-4 focus-within:ring-2">
          <Textarea
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={group ? `Escribe en ${group.name}, menciona con @` : ""}
            rows={1}
            className="max-h-48 min-h-10 resize-none border-0 bg-transparent px-0 py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Mensaje para el grupo"
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim() || busy} aria-label="Enviar">
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </form>

      {group && bots.data && <MembersSheet group={group} bots={bots.data} open={showMembers} onOpenChange={setShowMembers} />}
    </section>
  );
}
