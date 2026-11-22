import { Hammer, LayoutGrid, LogOut, Menu, Network, Plus, Users, Wallet } from "lucide-react";
import { type ReactNode, useState } from "react";
import { BotAvatar, GroupAvatar } from "@/components/bot-avatar";
import { MackMark } from "@/components/mack-mark";
import { NewBotDialog } from "@/components/new-bot-dialog";
import { NewGroupDialog } from "@/components/new-group-dialog";
import { StatusDot } from "@/components/status";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBots, useGroups, useHealth, useJobs } from "@/hooks/queries";
import { type Page, type Route, sameRoute } from "@/hooks/use-hash-route";
import { formatChatTime, previewText } from "@/lib/format";
import type { Bot, Group } from "@/lib/types";
import { cn } from "@/lib/utils";

const SYSTEM: { page: Page; label: string; icon: typeof Network }[] = [
  { page: "resumen", label: "Resumen", icon: LayoutGrid },
  { page: "matrix", label: "Matrix", icon: Network },
  { page: "factory", label: "Factory", icon: Hammer },
  { page: "ledger", label: "Ledger", icon: Wallet },
];

const byActivity = (a: Bot, b: Bot) =>
  a.kind !== b.kind
    ? a.kind === "orchestrator"
      ? -1
      : 1
    : (b.lastMessage?.at ?? "").localeCompare(a.lastMessage?.at ?? "") || a.name.localeCompare(b.name);

function ChatRow({ active, avatar, title, time, preview, onClick }: { active: boolean; avatar: ReactNode; title: string; time: string; preview: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        "hover:bg-accent/70 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active && "bg-accent",
      )}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium">{title}</span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{time}</span>
        </span>
        <span className="text-muted-foreground block truncate text-[13px]">{preview}</span>
      </span>
    </button>
  );
}

function Sidebar({ route, onNavigate, onLogout }: { route: Route; onNavigate: (r: Route) => void; onLogout: () => void }) {
  const bots = useBots();
  const groups = useGroups();
  const health = useHealth();
  const jobs = useJobs();
  const [creating, setCreating] = useState<"bot" | "group" | null>(null);
  const up = new Map(health.data?.map((h) => [h.agent, h.up]));
  const looks = Object.fromEntries((bots.data ?? []).map((b) => [b.name, { avatar: b.avatar, color: b.color }]));
  const building = jobs.data?.filter((j) => j.status === "running").length ?? 0;
  const mackUp = up.get("mack");

  const botPreview = (b: Bot) =>
    up.get(b.name) === false
      ? "Estacionado"
      : b.lastMessage
        ? `${{ user: "Tú: ", assistant: "", routine: "Rutina: " }[b.lastMessage.role]}${previewText(b.lastMessage.content)}`
        : b.description;
  const groupPreview = (g: Group) =>
    g.lastMessage ? `${g.lastMessage.author === "user" ? "Tú" : g.lastMessage.author}: ${previewText(g.lastMessage.content)}` : g.members.map((m) => `@${m}`).join(" ");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <MackMark className="size-7" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[17px] font-semibold tracking-tight">Mack</div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <StatusDot up={mackUp} />
            {mackUp === undefined ? "Conectando" : mackUp ? "En línea" : "Mack no responde"}
          </div>
        </div>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Nuevo">
                  <Plus />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Nuevo bot o grupo</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setCreating("bot")}>
              <Plus />
              Nuevo bot
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setCreating("group")}>
              <Users />
              Nuevo grupo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" aria-label="Chats">
        {bots.isLoading &&
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2.5 py-2">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        {[...(bots.data ?? [])].sort(byActivity).map((b) => (
          <ChatRow
            key={b.name}
            active={sameRoute(route, { view: "bot", name: b.name })}
            onClick={() => onNavigate({ view: "bot", name: b.name })}
            title={b.name}
            time={formatChatTime(b.lastMessage?.at)}
            preview={botPreview(b)}
            avatar={
              <span className={cn("relative", up.get(b.name) === false && "opacity-45 grayscale")}>
                <BotAvatar name={b.name} avatar={b.avatar} color={b.color} size={38} />
              </span>
            }
          />
        ))}
        {(groups.data?.length ?? 0) > 0 && <div className="text-muted-foreground px-2.5 pt-4 pb-1 text-xs font-medium">Grupos</div>}
        {groups.data?.map((g) => (
          <ChatRow
            key={g.id}
            active={sameRoute(route, { view: "group", id: g.id })}
            onClick={() => onNavigate({ view: "group", id: g.id })}
            title={g.name}
            time={formatChatTime(g.lastMessage?.createdAt)}
            preview={groupPreview(g)}
            avatar={<GroupAvatar members={g.members} looks={looks} size={38} />}
          />
        ))}
      </nav>

      <div className="border-t p-2">
        <div className="flex items-center gap-1">
          {SYSTEM.map(({ page, label, icon: Icon }) => (
            <Tooltip key={page}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={label}
                  aria-current={route.view === page ? "page" : undefined}
                  className={cn("relative", route.view === page ? "bg-accent text-foreground" : "text-muted-foreground")}
                  onClick={() => onNavigate({ view: page })}
                >
                  <Icon />
                  {page === "factory" && building > 0 && <span className="bg-forge absolute top-1.5 right-1.5 size-1.5 rounded-full" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{page === "factory" && building ? `Factory: ${building} construyendo` : label}</TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground ml-auto" aria-label="Salir" onClick={onLogout}>
                <LogOut />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Borra el token guardado en este navegador</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <NewBotDialog open={creating === "bot"} onOpenChange={(o) => !o && setCreating(null)} onCreated={(name) => onNavigate({ view: "bot", name })} />
      <NewGroupDialog open={creating === "group"} onOpenChange={(o) => !o && setCreating(null)} onCreated={(id) => onNavigate({ view: "group", id })} />
    </div>
  );
}

export function Shell({ route, onNavigate, onLogout, children }: { route: Route; onNavigate: (r: Route) => void; onLogout: () => void; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const isChat = route.view === "bot" || route.view === "group";
  const go = (r: Route) => {
    setDrawer(false);
    onNavigate(r);
  };

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <aside className="bg-background hidden w-76 shrink-0 border-r md:block">
        <Sidebar route={route} onNavigate={go} onLogout={onLogout} />
      </aside>

      <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
        <Button variant="ghost" size="icon" aria-label="Chats" onClick={() => setDrawer(true)}>
          <Menu />
        </Button>
        <MackMark className="size-6" />
        <span className="font-semibold">Mack</span>
      </div>
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-[86vw] max-w-80 p-0">
          <SheetTitle className="sr-only">Chats</SheetTitle>
          <Sidebar route={route} onNavigate={go} onLogout={onLogout} />
        </SheetContent>
      </Sheet>

      {isChat ? (
        <main className="relative flex min-h-0 min-w-0 flex-1">{children}</main>
      ) : (
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-7 md:px-10 md:py-10">
          <div className="blueprint pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden />
          <div className="relative mx-auto max-w-6xl">{children}</div>
        </main>
      )}
    </div>
  );
}
