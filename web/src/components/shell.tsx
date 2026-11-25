import { Hammer, LayoutGrid, LogOut, Menu, Moon, Network, Plus, Sun, Users, Wallet } from "lucide-react";
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
import { useBots, useGroups, useHealth, useJobs, useLedger } from "@/hooks/queries";
import { type Page, type Route, sameRoute } from "@/hooks/use-hash-route";
import { useTheme } from "@/hooks/use-theme";
import { formatChatTime, formatUsd, previewText } from "@/lib/format";
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

function Readout({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hover:bg-accent focus-visible:ring-ring flex h-full flex-col justify-center rounded-md px-3 text-left whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="text-muted-foreground text-[11px] leading-4">{label}</span>
      <span className="flex items-center gap-1.5 text-[13px] leading-5 font-medium tabular-nums">{children}</span>
    </button>
  );
}

function TopBar({ onNavigate, onLogout, onMenu }: { onNavigate: (r: Route) => void; onLogout: () => void; onMenu: () => void }) {
  const bots = useBots();
  const health = useHealth();
  const jobs = useJobs();
  const ledger = useLedger();
  const [theme, setTheme] = useTheme();

  const up = new Map(health.data?.map((h) => [h.agent, h.up]));
  const mackUp = up.get("mack");
  const dsas = bots.data?.filter((b) => b.kind === "dsa") ?? [];
  const dsasUp = dsas.filter((b) => up.get(b.name)).length;
  const running = jobs.data?.filter((j) => j.status === "running").length ?? 0;
  const queued = jobs.data?.filter((j) => j.status === "queued").length ?? 0;

  return (
    <header className="bg-card flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir navegación" onClick={onMenu}>
        <Menu />
      </Button>
      <button onClick={() => onNavigate({ view: "resumen" })} className="flex items-center gap-2 rounded-md pr-2 focus-visible:shadow-focus focus-visible:outline-none md:w-60">
        <MackMark className="size-6" />
        <span className="text-heading-16">Mack</span>
        <span className="text-muted-foreground hidden font-mono text-xs lg:inline">mac mini</span>
      </button>

      <div className="flex h-10 min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none]" aria-label="Estado en vivo">
        <Readout label="Mack" onClick={() => onNavigate({ view: "bot", name: "mack" })}>
          <StatusDot up={mackUp} />
          {mackUp === undefined ? "Conectando" : mackUp ? "En línea" : "No responde"}
        </Readout>
        <span className="bg-border my-2 w-px shrink-0" />
        <Readout label="Bots" onClick={() => onNavigate({ view: "matrix" })}>
          {health.data ? `${dsasUp} de ${dsas.length} en línea` : "—"}
        </Readout>
        <span className="bg-border my-2 hidden w-px shrink-0 sm:block" />
        <span className="hidden sm:contents">
          <Readout label="Factory" onClick={() => onNavigate({ view: "factory" })}>
            {running > 0 && <span className="bg-info size-2 animate-pulse rounded-full" />}
            {jobs.data ? (running || queued ? `${running} construyendo · ${queued} en cola` : "Libre") : "—"}
          </Readout>
        </span>
        <span className="bg-border my-2 hidden w-px shrink-0 lg:block" />
        <span className="hidden lg:contents">
          <Readout label="Este mes" onClick={() => onNavigate({ view: "ledger" })}>
            {ledger.data ? formatUsd(ledger.data.totalUsd) : "—"}
          </Readout>
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{theme === "dark" ? "Tema claro" : "Tema oscuro"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Salir" onClick={onLogout}>
            <LogOut />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Borra el token guardado en este navegador</TooltipContent>
      </Tooltip>
    </header>
  );
}

function ChatRow({ active, avatar, title, time, preview, onClick }: { active: boolean; avatar: ReactNode; title: string; time: string; preview: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
        "hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
        active && "bg-accent",
      )}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{title}</span>
          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">{time}</span>
        </span>
        <span className="text-muted-foreground block truncate text-xs">{preview}</span>
      </span>
    </button>
  );
}

function Rail({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  const bots = useBots();
  const groups = useGroups();
  const health = useHealth();
  const jobs = useJobs();
  const [creating, setCreating] = useState<"bot" | "group" | null>(null);
  const up = new Map(health.data?.map((h) => [h.agent, h.up]));
  const looks = Object.fromEntries((bots.data ?? []).map((b) => [b.name, { avatar: b.avatar, color: b.color }]));
  const building = jobs.data?.filter((j) => j.status === "running").length ?? 0;

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
      <nav className="space-y-0.5 border-b p-2" aria-label="Sistema">
        {SYSTEM.map(({ page, label, icon: Icon }) => {
          const active = route.view === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate({ view: page })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors",
                "hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
                active ? "bg-accent text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {page === "factory" && building > 0 && <span className="text-blue-900 font-mono text-xs tabular-nums">{building}</span>}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h2 className="text-muted-foreground text-xs font-medium">Chats</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" className="text-muted-foreground -mr-1.5">
              <Plus />
              Nuevo
            </Button>
          </DropdownMenuTrigger>
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
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-7 flex-1" />
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
                <BotAvatar name={b.name} avatar={b.avatar} color={b.color} size={32} />
                <StatusDot up={up.get(b.name)} className="ring-card absolute -right-0.5 -bottom-0.5 ring-2" />
              </span>
            }
          />
        ))}
        {(groups.data?.length ?? 0) > 0 && <h2 className="text-muted-foreground px-2 pt-4 pb-1 text-xs font-medium">Grupos</h2>}
        {groups.data?.map((g) => (
          <ChatRow
            key={g.id}
            active={sameRoute(route, { view: "group", id: g.id })}
            onClick={() => onNavigate({ view: "group", id: g.id })}
            title={g.name}
            time={formatChatTime(g.lastMessage?.createdAt)}
            preview={groupPreview(g)}
            avatar={<GroupAvatar members={g.members} looks={looks} size={32} />}
          />
        ))}
      </nav>

      <NewBotDialog open={creating === "bot"} onOpenChange={(o) => !o && setCreating(null)} onCreated={(name) => onNavigate({ view: "bot", name })} />
      <NewGroupDialog open={creating === "group"} onOpenChange={(o) => !o && setCreating(null)} onCreated={(id) => onNavigate({ view: "group", id })} />
    </div>
  );
}

/** Cockpit layout: the document never scrolls, only the rail and the main pane do. */
export function Shell({ route, onNavigate, onLogout, children }: { route: Route; onNavigate: (r: Route) => void; onLogout: () => void; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const ownsLayout = route.view === "bot" || route.view === "group" || route.view === "factory";
  const go = (r: Route) => {
    setDrawer(false);
    onNavigate(r);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar onNavigate={go} onLogout={onLogout} onMenu={() => setDrawer(true)} />
      <div className="flex min-h-0 flex-1">
        <aside className="bg-card hidden w-64 shrink-0 border-r md:block">
          <Rail route={route} onNavigate={go} />
        </aside>
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="w-[86vw] max-w-72 p-0">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <Rail route={route} onNavigate={go} />
          </SheetContent>
        </Sheet>

        {ownsLayout ? (
          <main className="relative flex min-h-0 min-w-0 flex-1">{children}</main>
        ) : (
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-5 py-6 md:px-8">{children}</div>
          </main>
        )}
      </div>
    </div>
  );
}
