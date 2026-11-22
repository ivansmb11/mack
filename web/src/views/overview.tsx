import { ArrowRight, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { BotAvatar } from "@/components/bot-avatar";
import { EmptyState } from "@/components/page-header";
import { JobStatusBadge, StatusDot } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBots, useHealth, useJobs, useLedger } from "@/hooks/queries";
import type { Route } from "@/hooks/use-hash-route";
import { formatAgo, formatTokens, formatUsd, repoName } from "@/lib/format";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-card flex min-w-0 flex-col rounded-lg border ${className ?? ""}`}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function SeeAll({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground -mr-2" onClick={onClick}>
      {children}
      <ArrowRight />
    </Button>
  );
}

export function OverviewView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const bots = useBots();
  const health = useHealth();
  const jobs = useJobs();
  const ledger = useLedger();

  const up = new Map(health.data?.map((h) => [h.agent, h.up]));
  const mackUp = up.get("mack");
  const dsas = bots.data?.filter((b) => b.kind === "dsa") ?? [];
  const onlineDsas = dsas.filter((b) => up.get(b.name)).length;
  const running = jobs.data?.filter((j) => j.status === "running").length ?? 0;
  const recentJobs = (jobs.data ?? []).slice(0, 6);

  const headline =
    mackUp === undefined
      ? "Revisando el estado de tus agentes…"
      : mackUp === false
        ? "Mack no responde en el gateway de Hermes."
        : running > 0
          ? `Todo en línea. El Factory está construyendo ${plural(running, "trabajo", "trabajos")}.`
          : "Todo en línea. El Factory está libre.";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1>Resumen</h1>
          <p className="text-muted-foreground mt-1">{headline}</p>
        </div>
        <Button onClick={() => onNavigate({ view: "bot", name: "mack" })}>
          <MessageCircle />
          Hablar con Mack
        </Button>
      </header>

      {mackUp === false && (
        <p className="border-destructive/40 bg-destructive/5 rounded-lg border px-4 py-3 text-sm">
          Revisa el gateway en el Mac mini con <code className="font-mono text-[13px]">hermes gateway status</code>. Los bots no reciben trabajo mientras Mack esté caído.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Section title="Bots" action={<SeeAll onClick={() => onNavigate({ view: "matrix" })}>Matrix</SeeAll>}>
          {bots.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : dsas.length === 0 ? (
            <div className="p-4">
              <EmptyState>Todavía no hay bots. Crea el primero con «Nuevo» en la barra lateral.</EmptyState>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground px-4 pt-3 text-xs">
                {onlineDsas} de {plural(dsas.length, "bot", "bots")} en línea
              </p>
              <ul className="p-2">
                {dsas.map((b) => (
                  <li key={b.name}>
                    <button
                      onClick={() => onNavigate({ view: "bot", name: b.name })}
                      className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <BotAvatar name={b.name} avatar={b.avatar} color={b.color} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{b.name}</span>
                        <span className="text-muted-foreground block truncate text-xs">{b.description}</span>
                      </span>
                      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                        <StatusDot up={up.get(b.name)} />
                        {up.get(b.name) === undefined ? "—" : up.get(b.name) ? "En línea" : "Estacionado"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section title="Factory" action={<SeeAll onClick={() => onNavigate({ view: "factory" })}>Ver trabajos</SeeAll>}>
          {jobs.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="p-4">
              <EmptyState>Sin trabajos todavía. Encola uno desde el Factory o pídeselo a Mack.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <button
                    onClick={() => onNavigate({ view: "factory" })}
                    className="hover:bg-accent/60 focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{job.task}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {repoName(job.repo)} · {formatAgo(job.createdAt)}
                      </span>
                    </span>
                    <JobStatusBadge status={job.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Gasto de este mes" action={<SeeAll onClick={() => onNavigate({ view: "ledger" })}>Ledger</SeeAll>}>
        {!ledger.data ? (
          <Skeleton className="m-4 h-20" />
        ) : (
          <div className="grid gap-6 p-4 md:grid-cols-[16rem_minmax(0,1fr)]">
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatUsd(ledger.data.totalUsd)}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatUsd(ledger.data.subscriptionsUsd)} en suscripciones y {formatUsd(ledger.data.meteredUsd)} medido por tokens.
              </p>
            </div>
            {ledger.data.perAgent.length === 0 ? (
              <EmptyState>Aún no hay consumo medido este mes.</EmptyState>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs">
                    <th className="pb-2 font-medium">Agente</th>
                    <th className="pb-2 text-right font-medium">Tokens</th>
                    <th className="pb-2 text-right font-medium">USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.data.perAgent.slice(0, 5).map((a) => (
                    <tr key={a.agent}>
                      <td className="py-1.5">
                        <span className="flex items-center gap-2">
                          <StatusDot up={up.get(a.agent)} />
                          {a.agent}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono text-[13px] tabular-nums">{formatTokens(a.tokens)}</td>
                      <td className="py-1.5 text-right font-mono text-[13px] tabular-nums">{formatUsd(a.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
