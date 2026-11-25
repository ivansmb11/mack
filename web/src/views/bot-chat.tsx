import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, CalendarClock, Loader2, PanelRight, Paperclip, ShieldAlert, Square, Wrench } from "lucide-react";
import { type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AvatarState } from "open-bot-avatar";
import { MessageAttachments, PendingAttachments } from "@/components/attachments";
import { BotAvatar } from "@/components/bot-avatar";
import { TypingBubble } from "@/components/chat";
import { Markdown } from "@/components/markdown";
import { StatusDot } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { keys, useBotMessages, useBots, useHealth } from "@/hooks/queries";
import { post } from "@/lib/api";
import { MAX_ATTACHMENTS, type PendingAttachment, prepareAttachment } from "@/lib/attachments";
import { formatClock } from "@/lib/format";
import { postSse } from "@/lib/sse";
import type { ApprovalChoice, ApprovalRequest, ChatMessage } from "@/lib/types";
import { enterAnimation, messageGap } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { BotPanel, type PanelTab } from "@/views/bot-panel";

interface ToolRun {
  name: string;
  preview?: string;
  state: "running" | "done" | "failed";
}

interface LiveTurn {
  user: string;
  attachments: PendingAttachment[];
  reply: string;
  tools: ToolRun[];
  runId?: string;
  approval?: ApprovalRequest;
  error?: string;
  /** History length when the turn started; later rows are this turn, already shown live. */
  historyCount: number;
}

/** What the bot's face shows while a turn is in flight. */
function faceState(turn: LiveTurn | null): AvatarState {
  if (!turn) return "idle";
  if (turn.error) return "blocked";
  if (turn.approval) return "waiting";
  if (turn.tools.some((t) => t.state === "running")) return "working";
  return turn.reply ? "working" : "thinking";
}

const CHOICE_LABEL: Record<ApprovalChoice, string> = {
  once: "Permitir esta vez",
  session: "Permitir en este chat",
  always: "Permitir siempre",
  deny: "No",
};

const MACK_SUGGESTIONS = ["¿Qué bots tengo y cuál conviene crear?", "¿Cuánto llevo gastado este mes?", "Arma un grupo con finanzas y dev para planear la semana"];
const BOT_SUGGESTIONS = ["¿Qué puedes hacer por mí?", "Ponte una rutina diaria a las 8:00 con lo más importante", "¿Qué recuerdas de mí?"];

const dayLabel = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" });
const dayKey = (iso: string) => new Date(iso).toDateString();

function DaySeparator({ iso }: { iso: string }) {
  const today = dayKey(new Date().toISOString()) === dayKey(iso);
  return (
    <li className="text-muted-foreground text-label-12 mt-6 mb-1 text-center first:mt-0">
      {today ? "Hoy" : dayLabel.format(new Date(iso))}, {formatClock(iso)}
    </li>
  );
}

function ToolsUsed({ tools }: { tools: string[] }) {
  if (!tools.length) return null;
  const unique = [...new Set(tools)];
  return (
    <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs">
      <Wrench className="size-3" />
      Usó {unique.slice(0, 4).join(", ")}
      {unique.length > 4 && ` y ${unique.length - 4} más`}
    </p>
  );
}

function RoutinePost({ message, onOpenRoutines }: { message: Extract<ChatMessage, { role: "routine" }>; onOpenRoutines: () => void }) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onOpenRoutines}
        className="text-muted-foreground hover:text-foreground mb-1.5 flex w-fit items-center gap-1.5 text-xs transition-colors"
      >
        <CalendarClock className="size-3" />
        Rutina “{message.routine.name}”{message.failed && " falló"}
      </button>
      <Bubble role="assistant" error={message.failed}>
        <Markdown>{message.content}</Markdown>
      </Bubble>
    </div>
  );
}

function Bubble({ role, children, error }: { role: "user" | "assistant"; children: React.ReactNode; error?: boolean }) {
  return (
    <div
      className={cn(
        "w-fit max-w-[min(68ch,85%)] rounded-xl px-4 py-2.5 text-[15px] leading-relaxed",
        role === "user" ? "bg-primary text-primary-foreground ml-auto rounded-br-sm" : "bg-secondary rounded-bl-sm",
        error && "text-destructive",
      )}
    >
      {children}
    </div>
  );
}

function ApprovalCard({ approval, bot, onAnswered }: { approval: ApprovalRequest; bot: string; onAnswered: () => void }) {
  const [sending, setSending] = useState<ApprovalChoice | null>(null);
  async function answer(choice: ApprovalChoice) {
    setSending(choice);
    try {
      await post(`/api/bots/${bot}/runs/${approval.runId}/approval`, { choice, ...(approval.requestId && { requestId: approval.requestId }) });
      onAnswered();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(null);
    }
  }
  return (
    <div className="border-amber-400 bg-amber-100 max-w-[min(68ch,85%)] rounded-xl border p-4" role="alert">
      <p className="flex items-center gap-2 font-medium">
        <ShieldAlert className="text-amber-900 size-4" />
        {bot} necesita tu permiso
      </p>
      {approval.description && <p className="text-muted-foreground mt-1 text-sm">{approval.description}</p>}
      {approval.command && <pre className="bg-background mt-3 overflow-x-auto rounded-md border p-2.5 font-mono text-xs whitespace-pre-wrap">{approval.command}</pre>}
      <div className="mt-3 flex flex-wrap gap-2">
        {approval.choices.map((c) => (
          <Button key={c} size="sm" variant={c === "once" ? "default" : c === "deny" ? "ghost" : "secondary"} disabled={sending !== null} onClick={() => answer(c)}>
            {sending === c && <Loader2 className="animate-spin" />}
            {CHOICE_LABEL[c]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function LiveTools({ tools }: { tools: ToolRun[] }) {
  if (!tools.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {tools.map((t, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
            t.state === "running" ? "border-blue-500 text-blue-900" : "border-input text-muted-foreground",
            t.state === "failed" && "border-destructive/40 text-destructive",
          )}
          title={t.preview}
        >
          {t.state === "running" ? <Loader2 className="text-blue-700 size-3 animate-spin" /> : <Wrench className="size-3" />}
          <span className="truncate">{t.name}</span>
        </span>
      ))}
    </div>
  );
}

function applyEvent(turn: LiveTurn, event: string, data: Record<string, unknown>): LiveTurn {
  switch (event) {
    case "run.started":
      return { ...turn, runId: String(data.run_id) };
    case "assistant.delta":
      return { ...turn, reply: turn.reply + String(data.delta ?? "") };
    case "assistant.completed":
      return { ...turn, reply: String(data.content ?? turn.reply) };
    case "tool.started":
      return { ...turn, tools: [...turn.tools, { name: String(data.tool_name), preview: data.preview ? String(data.preview) : undefined, state: "running" }] };
    case "tool.completed":
    case "tool.failed": {
      const i = turn.tools.findIndex((t) => t.state === "running" && t.name === data.tool_name);
      if (i < 0) return turn;
      const tools = turn.tools.with(i, { ...turn.tools[i], state: event === "tool.failed" ? "failed" : "done" });
      return { ...turn, tools };
    }
    case "approval.request":
      return {
        ...turn,
        approval: {
          runId: String(data.run_id),
          requestId: data.request_id ? String(data.request_id) : undefined,
          description: data.description ? String(data.description) : undefined,
          command: data.command ? String(data.command) : undefined,
          choices: (data.choices as ApprovalChoice[] | undefined) ?? ["once", "deny"],
        },
      };
    case "error":
      return { ...turn, error: String(data.message ?? "Algo falló") };
    default:
      return turn;
  }
}

export function BotChatView({ name }: { name: string }) {
  const qc = useQueryClient();
  const bots = useBots();
  const health = useHealth();
  const [live, setLive] = useState<LiveTurn | null>(null);
  const messages = useBotMessages(name, { poll: live === null });
  const bot = bots.data?.find((b) => b.name === name);
  const up = health.data?.find((h) => h.agent === name)?.up;

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const streaming = live !== null && !live.error;

  useEffect(() => {
    setLive(null);
    setDraft("");
    setPending([]);
  }, [name]);

  async function attach(files: Iterable<File>) {
    const list = [...files];
    if (!list.length) return;
    if (pending.length + list.length > MAX_ATTACHMENTS) {
      toast.error(`Máximo ${MAX_ATTACHMENTS} adjuntos por mensaje.`);
      return;
    }
    const results = await Promise.allSettled(list.map(prepareAttachment));
    for (const r of results) if (r.status === "rejected") toast.error((r.reason as Error).message);
    setPending((p) => [...p, ...results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))]);
  }

  function unattach(id: string) {
    setPending((p) => {
      const gone = p.find((a) => a.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return p.filter((a) => a.id !== id);
    });
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (!files.length) return;
    e.preventDefault();
    attach(files);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    attach(e.dataTransfer.files);
  };
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.data, live]);

  async function send(text: string) {
    const message = text.trim();
    const attachments = pending;
    if ((!message && !attachments.length) || streaming) return;
    setDraft("");
    setPending([]);
    let turn: LiveTurn = { user: message, attachments, reply: "", tools: [], historyCount: messages.data?.length ?? 0 };
    setLive(turn);
    try {
      const body = { message, attachments: attachments.map(({ name, type, data }) => ({ name, type, data })) };
      for await (const { event, data } of postSse(`/api/bots/${name}/chat`, body)) {
        turn = applyEvent(turn, event, data);
        setLive(turn);
      }
      if (turn.error) return;
      await qc.invalidateQueries({ queryKey: keys.messages(name) });
      qc.invalidateQueries({ queryKey: keys.bots });
      qc.invalidateQueries({ queryKey: keys.ledger });
      setLive(null);
    } catch (err) {
      setLive({ ...turn, error: (err as Error).message });
    }
  }

  async function stop() {
    if (!live?.runId) return;
    await post(`/api/bots/${name}/runs/${live.runId}/stop`).catch((err: Error) => toast.error(err.message));
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  const history: ChatMessage[] = live ? (messages.data ?? []).slice(0, live.historyCount) : (messages.data ?? []);
  const empty = !messages.isLoading && history.length === 0 && !live;
  const suggestions = name === "mack" ? MACK_SUGGESTIONS : BOT_SUGGESTIONS;

  return (
    <div className="flex min-w-0 flex-1">
      <section
        className="relative flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        {dragging && (
          <div className="bg-blue-100/90 border-blue-700 text-blue-900 pointer-events-none absolute inset-3 z-10 grid place-items-center rounded-xl border-2 border-dashed">
            <p className="text-lg">Suelta para adjuntarlo a {name}</p>
          </div>
        )}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="w-20" />
          <button
            onClick={() => setPanel(panel === "perfil" ? null : "perfil")}
            className="hover:bg-accent flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 transition-colors"
          >
            <BotAvatar name={name} avatar={bot?.avatar} color={bot?.color} size={24} state={faceState(live)} />
            <span className="truncate font-medium">{name}</span>
            <StatusDot up={up} />
          </button>
          <div className="flex w-20 justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label="Rutinas" aria-pressed={panel === "rutinas"} onClick={() => setPanel(panel === "rutinas" ? null : "rutinas")}>
              <CalendarClock />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Perfil" aria-pressed={panel === "perfil"} onClick={() => setPanel(panel === "perfil" ? null : "perfil")}>
              <PanelRight />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" aria-live="polite">
          {messages.isLoading ? (
            <div className="mx-auto max-w-3xl space-y-4">
              <Skeleton className="ml-auto h-10 w-1/2 rounded-xl" />
              <Skeleton className="h-24 w-2/3 rounded-xl" />
            </div>
          ) : messages.isError ? (
            <p className="text-muted-foreground mx-auto max-w-md pt-20 text-center">
              No pude leer el chat de {name}: {messages.error.message}. Si está estacionado, reactívalo desde su perfil.
            </p>
          ) : empty ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-[12vh] text-center">
              <BotAvatar name={name} avatar={bot?.avatar} color={bot?.color} size={96} live />
              <div>
                <h1 className="text-2xl">{name}</h1>
                <p className="text-muted-foreground mt-1">{bot?.description}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {suggestions.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-auto rounded-full py-1.5 font-normal whitespace-normal" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="mx-auto flex max-w-3xl flex-col">
              {history.map((m, i) => {
                const prev = history[i - 1];
                const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
                const sameAuthor = !newDay && prev.role === m.role && m.role !== "routine";
                return (
                  <Fragment key={m.id}>
                    {newDay && <DaySeparator iso={m.at} />}
                    <li className={cn("flex flex-col gap-1.5", messageGap(newDay, sameAuthor))}>
                      {m.role === "routine" ? (
                        <RoutinePost message={m} onOpenRoutines={() => setPanel("rutinas")} />
                      ) : (
                        <>
                          {m.role === "assistant" && <ToolsUsed tools={m.toolsUsed} />}
                          {m.role === "user" && <MessageAttachments bot={name} items={m.attachments} />}
                          {m.content && (
                            <Bubble role={m.role}>{m.role === "assistant" ? <Markdown>{m.content}</Markdown> : <span className="whitespace-pre-wrap">{m.content}</span>}</Bubble>
                          )}
                        </>
                      )}
                    </li>
                  </Fragment>
                );
              })}
              {live && (
                <>
                  <li className={cn("flex flex-col gap-1.5", messageGap(history.length === 0, history.at(-1)?.role === "user"), enterAnimation)}>
                    <PendingAttachments items={live.attachments} className="justify-end" />
                    {live.user && (
                      <Bubble role="user">
                        <span className="whitespace-pre-wrap">{live.user}</span>
                      </Bubble>
                    )}
                  </li>
                  <li className={cn("mt-5 flex flex-col gap-2", enterAnimation)}>
                    <LiveTools tools={live.tools} />
                    {live.approval && <ApprovalCard approval={live.approval} bot={name} onAnswered={() => setLive((t) => t && { ...t, approval: undefined })} />}
                    {(live.reply || live.error) && (
                      <Bubble role="assistant" error={Boolean(live.error)}>
                        {live.error ? live.error : <Markdown>{live.reply}</Markdown>}
                      </Bubble>
                    )}
                    {!live.reply && !live.error && !live.approval && (
                      <div role="status" className="flex items-end gap-2">
                        <TypingBubble />
                        <span className="text-muted-foreground text-label-12 pb-1">
                          {name} está {live.tools.some((t) => t.state === "running") ? "trabajando" : "pensando"}
                        </span>
                      </div>
                    )}
                  </li>
                </>
              )}
            </ol>
          )}
          <div ref={bottom} />
        </div>

        <form onSubmit={onSubmit} className="px-4 pt-1 pb-4">
          <div className="bg-card mx-auto flex max-w-3xl flex-wrap items-end gap-2 rounded-3xl border p-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-gray-alpha-600 focus-within:shadow-[0_0_0_4px_var(--ds-gray-alpha-200)]">
            <PendingAttachments items={pending} onRemove={unattach} className="w-full px-2.5 pt-2" />
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                attach(e.target.files ?? []);
                e.target.value = "";
              }}
            />
            <Button type="button" size="icon" variant="ghost" className="rounded-full" onClick={() => picker.current?.click()} aria-label="Adjuntar imágenes o archivos">
              <Paperclip />
            </Button>
            <Textarea
              onPaste={onPaste}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Escríbele a ${name}`}
              rows={1}
              className="max-h-48 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2.5 shadow-none focus-visible:shadow-none dark:bg-transparent"
              aria-label={`Mensaje para ${name}`}
            />
            {streaming ? (
              <Button type="button" size="icon" variant="secondary" className="rounded-full" onClick={stop} disabled={!live?.runId} aria-label="Detener">
                <Square />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim() && !pending.length} aria-label="Enviar">
                <ArrowUp />
              </Button>
            )}
          </div>
        </form>
      </section>

      <BotPanel name={name} tab={panel} onTabChange={setPanel} />
    </div>
  );
}
