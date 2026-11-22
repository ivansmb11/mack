import { Compass, Loader2, Plus, Send, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { EmptyState, PageHeader, Panel } from "@/components/page-header";
import { DispatchStatus } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAgents, useDispatch, useRoute } from "@/hooks/queries";
import { formatInteger } from "@/lib/format";
import type { Agent } from "@/lib/types";

const AUTO = "__auto__";

function AgentSelect({ value, onChange, agents, id }: { value: string; onChange: (v: string) => void; agents: Agent[]; id?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>Que Matrix decida</SelectItem>
        {agents.map((a) => (
          <SelectItem key={a.name} value={a.name}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const toRequest = (task: string, agent: string, context?: string) => ({
  task: task.trim(),
  ...(agent !== AUTO && { agent }),
  ...(context?.trim() && { context: context.trim() }),
});

export function MatrixView() {
  const agents = useAgents();
  const dsas = agents.data?.filter((a) => a.kind === "dsa") ?? [];
  const route = useRoute();
  const dispatch = useDispatch();

  const [task, setTask] = useState("");
  const [agent, setAgent] = useState(AUTO);
  const [context, setContext] = useState("");
  const [batch, setBatch] = useState([{ task: "", agent: AUTO }]);

  const submitOne = (e: FormEvent) => {
    e.preventDefault();
    dispatch.mutate([toRequest(task, agent, context)]);
  };
  const submitBatch = (e: FormEvent) => {
    e.preventDefault();
    dispatch.mutate(batch.filter((b) => b.task.trim()).map((b) => toRequest(b.task, b.agent)));
  };

  return (
    <div>
      <PageHeader title="Matrix" description="Manda trabajo directo a tus DSAs. Mack hace lo mismo cuando platicas con él." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <Tabs defaultValue="one">
            <TabsList className="mb-4">
              <TabsTrigger value="one">Una tarea</TabsTrigger>
              <TabsTrigger value="many">Varias en paralelo</TabsTrigger>
            </TabsList>

            <TabsContent value="one">
              <form onSubmit={submitOne} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task">Tarea</Label>
                  <Textarea
                    id="task"
                    value={task}
                    onChange={(e) => {
                      setTask(e.target.value);
                      route.reset();
                    }}
                    placeholder="Resume mis gastos de octubre y marca los que parezcan duplicados"
                    className="min-h-28"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent">DSA</Label>
                    <AgentSelect id="agent" value={agent} onChange={setAgent} agents={dsas} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="context">Contexto extra</Label>
                    <Textarea id="context" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Opcional" className="min-h-9" rows={1} />
                  </div>
                </div>

                {route.data && (
                  <div className="bg-background rounded-md border p-3 text-sm">
                    {route.data.agent ? (
                      <p>
                        Matrix se la daría a <span className="text-signal font-medium">{route.data.agent}</span>
                        {route.data.candidates.length > 1 &&
                          `. También coincide con ${route.data.candidates
                            .slice(1)
                            .map((c) => c.agent)
                            .join(", ")}.`}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Ningún DSA reclama esta tarea. Mack la resolvería él mismo.</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!task.trim() || dispatch.isPending}>
                    {dispatch.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    Despachar
                  </Button>
                  <Button type="button" variant="secondary" disabled={!task.trim() || route.isPending} onClick={() => route.mutate(task)}>
                    <Compass />
                    Ver a quién le toca
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="many">
              <form onSubmit={submitBatch} className="space-y-3">
                {batch.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_10rem_auto] items-start gap-2">
                    <Textarea
                      value={row.task}
                      onChange={(e) => setBatch(batch.map((b, j) => (j === i ? { ...b, task: e.target.value } : b)))}
                      placeholder={`Tarea ${i + 1}`}
                      aria-label={`Tarea ${i + 1}`}
                      className="min-h-9"
                      rows={1}
                    />
                    <AgentSelect value={row.agent} onChange={(v) => setBatch(batch.map((b, j) => (j === i ? { ...b, agent: v } : b)))} agents={dsas} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Quitar tarea" disabled={batch.length === 1} onClick={() => setBatch(batch.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" disabled={!batch.some((b) => b.task.trim()) || dispatch.isPending}>
                    {dispatch.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    Despachar todas
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setBatch([...batch, { task: "", agent: AUTO }])}>
                    <Plus />
                    Agregar tarea
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </Panel>

        <Panel title="Respuestas">
          {dispatch.isPending ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Los DSAs están trabajando. Las tareas largas pueden tardar varios minutos.
            </div>
          ) : !dispatch.data ? (
            <EmptyState>Lo que respondan los DSAs aparecerá aquí, con los tokens que gastó cada uno.</EmptyState>
          ) : (
            <ol className="space-y-4">
              {dispatch.data.map((r, i) => (
                <li key={i} className="bg-background rounded-md border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-medium">{r.agent || "Sin DSA"}</span>
                    <DispatchStatus status={r.status} />
                  </div>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{r.content}</p>
                  {r.usage && (
                    <p className="text-muted-foreground mt-3 text-xs tabular-nums">
                      {formatInteger(r.usage.prompt_tokens + r.usage.completion_tokens)} tokens
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
