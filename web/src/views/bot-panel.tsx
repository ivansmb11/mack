import { ChevronDown, Loader2, MoreHorizontal, Pause, Play, Plus, Trash2, X, Zap } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { BotAvatar } from "@/components/bot-avatar";
import { LookPicker } from "@/components/look-picker";
import { Markdown } from "@/components/markdown";
import { StatusDot } from "@/components/status";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAgentAction, useBotProfile, useHealth, useRoutineMutations, useRoutineRuns, useRoutines, useUpdateBot } from "@/hooks/queries";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatAgo, formatTokens, formatUsd } from "@/lib/format";
import type { BotProfile, Routine } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PanelTab = "perfil" | "rutinas";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

type Cadence = "daily" | "weekdays" | "weekly" | "hourly" | "custom";
const CADENCES: Record<Cadence, string> = {
  daily: "Todos los días",
  weekdays: "Días hábiles",
  weekly: "Cada lunes",
  hourly: "Cada hora",
  custom: "Cron personalizado",
};

function toCron(cadence: Cadence, time: string, custom: string): string {
  const [h, m] = time.split(":").map(Number);
  return {
    daily: `${m} ${h} * * *`,
    weekdays: `${m} ${h} * * 1-5`,
    weekly: `${m} ${h} * * 1`,
    hourly: "0 * * * *",
    custom: custom.trim(),
  }[cadence];
}

/** Reads back the cron shapes this panel writes; anything else is shown as the raw expression. */
export function describeSchedule(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [m, h, dom, mon, dow] = parts;
  if (m === "0" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "Cada hora";
  if (!/^\d+$/.test(m) || !/^\d+$/.test(h) || dom !== "*" || mon !== "*") return expr;
  const at = `a las ${h}:${m.padStart(2, "0")}`;
  if (dow === "*") return `Todos los días ${at}`;
  if (dow === "1-5") return `Días hábiles ${at}`;
  if (/^[0-6]$/.test(dow)) return `Cada ${WEEKDAYS[Number(dow)]} ${at}`;
  return expr;
}

function ProfileTab({ profile }: { profile: BotProfile }) {
  const update = useUpdateBot(profile.name);
  const action = useAgentAction();
  const health = useHealth();
  const up = health.data?.find((h) => h.agent === profile.name)?.up;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(() => ({
    description: profile.description,
    instructions: profile.instructions,
    domains: profile.domains.join(", "),
    provider: profile.provider,
    model: profile.model,
  }));
  const isDsa = profile.kind === "dsa";
  const dirty =
    form.description !== profile.description ||
    form.instructions !== profile.instructions ||
    form.domains !== profile.domains.join(", ") ||
    form.provider !== profile.provider ||
    form.model !== profile.model;

  function save(e: FormEvent) {
    e.preventDefault();
    update.mutate({
      ...(form.description !== profile.description && { description: form.description }),
      ...(form.instructions !== profile.instructions && { instructions: form.instructions }),
      ...(form.domains !== profile.domains.join(", ") && { domains: form.domains.split(",").map((d) => d.trim()).filter(Boolean) }),
      ...((form.provider !== profile.provider || form.model !== profile.model) && { model: { provider: form.provider, default: form.model } }),
    });
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BotAvatar name={profile.name} avatar={profile.avatar} color={profile.color} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{profile.name}</p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <StatusDot up={up} />
            {up === false ? "Estacionado" : isDsa ? "Bot" : "Orquestador"}
          </p>
        </div>
        {isDsa && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Acciones de ${profile.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {up === false ? (
                <DropdownMenuItem onSelect={() => action.mutate({ name: profile.name, action: "start" })}>
                  <Play />
                  Reactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => action.mutate({ name: profile.name, action: "stop" })}>
                  <Pause />
                  Estacionar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isDsa && (
        <div className="space-y-2">
          <Label>Cara</Label>
          <LookPicker name={profile.name} value={{ avatar: profile.avatar, color: profile.color }} onChange={(look) => look && update.mutate(look)} />
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bot-description">Para qué es</Label>
          <Input id="bot-description" value={form.description} onChange={set("description")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bot-instructions">Instrucciones</Label>
          <Textarea id="bot-instructions" value={form.instructions} onChange={set("instructions")} className="min-h-56 font-mono text-[13px]" />
          <p className="text-muted-foreground text-xs">Su SOUL.md. Las reglas de cómo trabaja dentro de Mack se agregan solas.</p>
        </div>
        {isDsa && (
          <div className="space-y-2">
            <Label htmlFor="bot-domains">Temas que le tocan</Label>
            <Input id="bot-domains" value={form.domains} onChange={set("domains")} placeholder="gastos, factura, sat" />
            <p className="text-muted-foreground text-xs">Matrix y los grupos le pasan los mensajes que mencionan estos temas.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="bot-provider">Proveedor</Label>
            <Input id="bot-provider" value={form.provider} onChange={set("provider")} className="font-mono text-[13px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bot-model">Modelo</Label>
            <Input id="bot-model" value={form.model} onChange={set("model")} className="font-mono text-[13px]" />
          </div>
        </div>
        <Button type="submit" disabled={!dirty || update.isPending} className="w-full">
          {update.isPending && <Loader2 className="animate-spin" />}
          Guardar cambios
        </Button>
      </form>

      <div className="space-y-2 border-t pt-5">
        <p className="text-sm font-medium">Este mes</p>
        <p className="text-2xl font-semibold tabular-nums">{formatTokens(profile.spend.tokens)} tokens</p>
        <p className="text-muted-foreground text-sm">
          {formatUsd(profile.spend.usd)}
          {profile.budget?.monthlyTokens ? ` de un límite de ${formatTokens(profile.budget.monthlyTokens)} tokens` : profile.budget?.monthlyUsd ? ` de un límite de ${formatUsd(profile.budget.monthlyUsd)}` : ", sin límite"}
          . El límite se cambia en el Ledger.
        </p>
        {profile.packs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {profile.packs.map((p) => (
              <Badge key={p} variant="outline" className="font-mono font-normal">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {profile.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra su perfil de Hermes: memoria, chat, rutinas y llaves. El historial de gasto se queda en el Ledger. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => action.mutate({ name: profile.name, action: "remove" }, { onSuccess: () => (window.location.hash = "/bot/mack") })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoutineRuns({ bot, routine }: { bot: string; routine: Routine }) {
  const runs = useRoutineRuns(bot, routine.id, true);
  if (runs.isLoading) return <Skeleton className="h-16" />;
  if (!runs.data?.length) return <p className="text-muted-foreground text-sm">Todavía no ha corrido.</p>;
  return (
    <ol className="space-y-3">
      {runs.data.map((r) => (
        <li key={r.at} className="bg-background rounded-md border p-3">
          <p className="text-muted-foreground mb-1.5 text-xs">{new Date(r.at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</p>
          <Markdown className="max-h-64 overflow-y-auto text-sm">{r.output}</Markdown>
        </li>
      ))}
    </ol>
  );
}

function RoutineItem({ bot, routine }: { bot: string; routine: Routine }) {
  const { action, remove } = useRoutineMutations(bot);
  const [open, setOpen] = useState(false);
  const failed = routine.lastStatus && routine.lastStatus !== "ok" && routine.lastStatus !== "success";
  return (
    <li className="bg-card rounded-lg border">
      <div className="flex items-start gap-3 p-3">
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <p className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{routine.name}</span>
            <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")} />
          </p>
          <p className="text-muted-foreground text-sm">{describeSchedule(routine.schedule)}</p>
          <p className={cn("text-xs", failed ? "text-destructive" : "text-muted-foreground")}>
            {routine.lastRunAt ? `Última vez ${formatAgo(routine.lastRunAt)}${failed ? `: ${routine.lastError ?? routine.lastStatus}` : ""}` : "Aún no corre"}
          </p>
        </button>
        <Switch
          checked={routine.enabled}
          aria-label={routine.enabled ? `Pausar ${routine.name}` : `Activar ${routine.name}`}
          onCheckedChange={(on) => action.mutate({ id: routine.id, action: on ? "resume" : "pause" })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mt-1 size-8" aria-label={`Acciones de ${routine.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => action.mutate({ id: routine.id, action: "run" })}>
              <Zap />
              Correr ahora
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(routine.id)}>
              <Trash2 />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div className="space-y-3 border-t p-3">
          <p className="text-sm whitespace-pre-wrap">{routine.prompt}</p>
          <RoutineRuns bot={bot} routine={routine} />
        </div>
      )}
    </li>
  );
}

function NewRoutine({ bot, onDone }: { bot: string; onDone: () => void }) {
  const { create } = useRoutineMutations(bot);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cadence, setCadence] = useState<Cadence>("weekdays");
  const [time, setTime] = useState("08:00");
  const [custom, setCustom] = useState("");
  const schedule = toCron(cadence, time, custom);

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), prompt: prompt.trim(), schedule, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={submit} className="bg-card space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">Nueva rutina</p>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onDone} aria-label="Cancelar">
          <X />
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="routine-name">Nombre</Label>
        <Input id="routine-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte de la mañana" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="routine-prompt">Qué hace</Label>
        <Textarea id="routine-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Revisa mis gastos de ayer y avísame si algo se sale de lo normal." className="min-h-24" />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-2">
          <Label htmlFor="routine-cadence">Cuándo</Label>
          <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
            <SelectTrigger id="routine-cadence" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CADENCES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {cadence !== "hourly" && cadence !== "custom" && (
          <div className="space-y-2">
            <Label htmlFor="routine-time">Hora</Label>
            <Input id="routine-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
          </div>
        )}
      </div>
      {cadence === "custom" && <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="*/30 9-18 * * 1-5" className="font-mono text-[13px]" aria-label="Expresión cron" />}
      <Button type="submit" className="w-full" disabled={!name.trim() || !prompt.trim() || !schedule || create.isPending}>
        {create.isPending && <Loader2 className="animate-spin" />}
        Crear rutina
      </Button>
    </form>
  );
}

function RoutinesTab({ bot }: { bot: string }) {
  const routines = useRoutines(bot);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    setAdding(false);
  }, [bot]);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {bot} trabaja solo a la hora que le digas, aunque no estés aquí. Cada corrida queda en su historial.
      </p>
      {adding ? (
        <NewRoutine bot={bot} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
          <Plus />
          Nueva rutina
        </Button>
      )}
      {routines.isLoading ? (
        <Skeleton className="h-20" />
      ) : routines.isError ? (
        <p className="text-destructive text-sm">{routines.error.message}</p>
      ) : (
        <ul className="space-y-2">
          {routines.data?.map((r) => (
            <RoutineItem key={r.id} bot={bot} routine={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PanelBody({ name, tab, onTabChange }: { name: string; tab: PanelTab; onTabChange: (t: PanelTab | null) => void }) {
  const profile = useBotProfile(name);
  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as PanelTab)} className="flex h-full flex-col gap-0">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="rutinas">Rutinas</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onTabChange(null)} aria-label="Cerrar panel">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="perfil">
          {profile.data ? <ProfileTab key={`${name}-${profile.dataUpdatedAt}`} profile={profile.data} /> : <Skeleton className="h-64" />}
        </TabsContent>
        <TabsContent value="rutinas">
          <RoutinesTab bot={name} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

/** Docked beside the chat on wide screens, a sheet on narrow ones. */
export function BotPanel({ name, tab, onTabChange }: { name: string; tab: PanelTab | null; onTabChange: (t: PanelTab | null) => void }) {
  const wide = useMediaQuery("(min-width: 1180px)");
  if (wide)
    return tab ? (
      <aside className="bg-background w-96 shrink-0 border-l">
        <PanelBody name={name} tab={tab} onTabChange={onTabChange} />
      </aside>
    ) : null;
  return (
    <Sheet open={tab !== null} onOpenChange={(o) => !o && onTabChange(null)}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md [&>button:last-child]:hidden">
        <SheetTitle className="sr-only">Perfil de {name}</SheetTitle>
        {tab && <PanelBody name={name} tab={tab} onTabChange={onTabChange} />}
      </SheetContent>
    </Sheet>
  );
}
