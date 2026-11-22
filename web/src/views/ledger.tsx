import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { EmptyState, PageHeader, Panel } from "@/components/page-header";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBudgets, useLedger, useRemoveSubscription, useSaveBudget, useSaveSubscription } from "@/hooks/queries";
import { formatInteger, formatTokens, formatUsd } from "@/lib/format";
import type { AgentBudget, Subscription } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY_SUBSCRIPTION: Subscription = { id: "", provider: "", plan: "", monthlyUsd: 0, renewsOn: null, monthlyTokenQuota: null, notes: null };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const optionalNumber = (v: string) => (v.trim() === "" ? null : Number(v));

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

function SubscriptionDialog({ initial, onClose }: { initial: Subscription | null; onClose: () => void }) {
  const save = useSaveSubscription();
  const [form, setForm] = useState<Subscription>(initial ?? EMPTY_SUBSCRIPTION);
  const isNew = !initial?.id;
  const set = <K extends keyof Subscription>(key: K, value: Subscription[K]) => setForm((f) => ({ ...f, [key]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const id = form.id || slug(`${form.provider} ${form.plan}`);
    save.mutate({ ...form, id }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{isNew ? "Agregar suscripción" : `Editar ${initial?.plan}`}</DialogTitle>
            <DialogDescription>Las suscripciones de tarifa fija se suman al gasto del mes junto con lo medido por tokens.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Proveedor</Label>
              <Input id="provider" required value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Anthropic" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Input id="plan" required value={form.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Claude Max 20x" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usd">Costo mensual (USD)</Label>
              <Input id="usd" type="number" min={0} step="0.01" required value={form.monthlyUsd} onChange={(e) => set("monthlyUsd", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="renews">Se renueva</Label>
              <Input id="renews" type="date" value={form.renewsOn ?? ""} onChange={(e) => set("renewsOn", e.target.value || null)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} placeholder="La usa el Factory vía CLAUDE_CODE_OAUTH_TOKEN" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Guardar suscripción
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetDialog({ row, onClose }: { row: AgentBudget; onClose: () => void }) {
  const save = useSaveBudget();
  const [tokens, setTokens] = useState(row.budget?.monthlyTokens?.toString() ?? "");
  const [usd, setUsd] = useState(row.budget?.monthlyUsd?.toString() ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ agent: row.agent, budget: { monthlyTokens: optionalNumber(tokens), monthlyUsd: optionalNumber(usd) } }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Presupuesto de {row.agent}</DialogTitle>
            <DialogDescription>Cuando lo alcance, Matrix rechaza sus tareas hasta el mes siguiente. Deja un campo vacío para no limitarlo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-tokens">Tokens al mes</Label>
              <Input id="b-tokens" type="number" min={1} value={tokens} onChange={(e) => setTokens(e.target.value)} placeholder="Sin límite" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-usd">USD al mes</Label>
              <Input id="b-usd" type="number" min={0.01} step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="Sin límite" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Guardar presupuesto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LedgerView() {
  const ledger = useLedger();
  const budgets = useBudgets();
  const remove = useRemoveSubscription();
  const [editingSub, setEditingSub] = useState<Subscription | null | undefined>(undefined);
  const [removingSub, setRemovingSub] = useState<Subscription | null>(null);
  const [editingBudget, setEditingBudget] = useState<AgentBudget | null>(null);

  const month = ledger.data && new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(`${ledger.data.month}-01T00:00:00`));

  return (
    <div>
      <PageHeader title="Ledger" description="Lo que te cuesta Mack: tokens por agente, presupuestos y suscripciones." />

      <div className="space-y-6">
        <Panel>
          {ledger.data ? (
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-muted-foreground text-sm first-letter:uppercase">{month}</p>
                <p className="text-glow text-5xl font-semibold tracking-tight tabular-nums">{formatUsd(ledger.data.totalUsd)}</p>
              </div>
              <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Suscripciones</dt>
                <dt className="text-muted-foreground">Medido por tokens</dt>
                <dt className="text-muted-foreground">Tokens sin precio</dt>
                <dd className="text-lg tabular-nums">{formatUsd(ledger.data.subscriptionsUsd)}</dd>
                <dd className="text-lg tabular-nums">{formatUsd(ledger.data.meteredUsd)}</dd>
                <dd className="text-lg tabular-nums">{formatTokens(ledger.data.unpricedTokens)}</dd>
              </dl>
            </div>
          ) : (
            <Skeleton className="h-16" />
          )}
          {ledger.data && ledger.data.unpricedTokens > 0 && (
            <p className="text-muted-foreground mt-4 text-xs">Hay modelos sin precio en mack.config.yaml; sus tokens cuentan para los presupuestos por tokens, no para los de USD.</p>
          )}
        </Panel>

        <Panel title="Presupuestos por agente" description="Consumo del mes medido por Matrix y por /v1.">
          {!budgets.data ? (
            <Skeleton className="h-24" />
          ) : budgets.data.length === 0 ? (
            <EmptyState>Cuando existan agentes, aquí verás su consumo contra su presupuesto.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="w-[40%]">Tokens del mes</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.data.map((row) => {
                  const limit = row.budget?.monthlyTokens;
                  const pct = limit ? Math.min(100, (row.spend.tokens / limit) * 100) : 0;
                  return (
                    <TableRow key={row.agent}>
                      <TableCell className="font-medium">{row.agent}</TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs tabular-nums">
                            <span>{formatInteger(row.spend.tokens)}</span>
                            <span className="text-muted-foreground">{limit ? `de ${formatTokens(limit)}` : "sin límite"}</span>
                          </div>
                          {limit && <Progress value={pct} className={cn("h-1.5", pct >= 90 && "[&>div]:bg-destructive", pct >= 70 && pct < 90 && "[&>div]:bg-warn")} />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUsd(row.spend.usd)}
                        {row.budget?.monthlyUsd && <span className="text-muted-foreground"> / {formatUsd(row.budget.monthlyUsd)}</span>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" aria-label={`Editar presupuesto de ${row.agent}`} onClick={() => setEditingBudget(row)}>
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Suscripciones"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setEditingSub(null)}>
              <Plus />
              Agregar suscripción
            </Button>
          }
        >
          {!ledger.data ? (
            <Skeleton className="h-24" />
          ) : ledger.data.subscriptions.length === 0 ? (
            <EmptyState>Registra tu Claude Max, ChatGPT u OpenRouter para ver el gasto real del mes.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Mensual</TableHead>
                  <TableHead>Renovación</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.data.subscriptions.map((s) => {
                  const days = daysUntil(s.renewsOn);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.plan}</div>
                        <div className="text-muted-foreground text-xs">{s.provider}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(s.monthlyUsd)}</TableCell>
                      <TableCell className={cn("text-sm", days !== null && days <= 7 && "text-warn")}>
                        {s.renewsOn ? (days !== null && days >= 0 ? `${s.renewsOn}, en ${days} ${days === 1 ? "día" : "días"}` : s.renewsOn) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${s.plan}`} onClick={() => setEditingSub(s)}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Eliminar ${s.plan}`} onClick={() => setRemovingSub(s)}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>

      {editingSub !== undefined && <SubscriptionDialog initial={editingSub} onClose={() => setEditingSub(undefined)} />}
      {editingBudget && <BudgetDialog row={editingBudget} onClose={() => setEditingBudget(null)} />}

      <AlertDialog open={removingSub !== null} onOpenChange={(o) => !o && setRemovingSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {removingSub?.plan}?</AlertDialogTitle>
            <AlertDialogDescription>Deja de sumarse al gasto del mes. No cancela nada con el proveedor.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => removingSub && remove.mutate(removingSub.id)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
