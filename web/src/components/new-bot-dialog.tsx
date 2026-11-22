import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { stringify } from "yaml";
import { type ChosenLook, LookPicker } from "@/components/look-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAgent, useRecommendedLook, useTemplates } from "@/hooks/queries";

const NAME = /^[a-z][a-z0-9-]{1,30}$/;
const DEFAULT_MODEL = { provider: "anthropic", default: "claude-sonnet-5-5" };

const YAML_STARTER = stringify({
  name: "viajes",
  description: "Planeación de viajes: vuelos, hoteles e itinerarios.",
  domains: ["viaje", "vuelo", "hotel", "itinerario", "reservacion"],
  model: DEFAULT_MODEL,
  packs: ["matt-pocock-thinking"],
  budget: { monthlyTokens: 5_000_000 },
  soul: "# Viajes\n\nEres el bot de viajes de Iván. Comparas opciones con precios reales y nunca reservas sin confirmación.\n",
});

export function NewBotDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (name: string) => void }) {
  const templates = useTemplates();
  const create = useCreateAgent();
  const [mode, setMode] = useState<"blank" | "template" | "yaml">("blank");
  const [name, setName] = useState("");
  const [look, setLook] = useState<ChosenLook | null>(null);
  const [description, setDescription] = useState("");
  const [domains, setDomains] = useState("");
  const [instructions, setInstructions] = useState("");
  const [template, setTemplate] = useState("");
  const [yaml, setYaml] = useState(YAML_STARTER);
  const selected = templates.data?.find((t) => t.name === template);
  const topics = domains.split(",").map((d) => d.trim()).filter(Boolean);
  const recommended = useRecommendedLook(
    mode === "template" ? { name: name || template, description: selected?.description, domains: selected?.domains } : { name, description, domains: topics },
    open && mode !== "yaml",
  );

  const validName = NAME.test(name);
  const canSubmit =
    mode === "yaml" ? yaml.trim().length > 0 : mode === "template" ? Boolean(template) && (!name || validName) : validName && description.trim().length >= 10 && instructions.trim().length >= 20;

  function submit(e: FormEvent) {
    e.preventDefault();
    const input =
      mode === "yaml"
        ? { yaml }
        : mode === "template"
          ? { template, name: name || undefined, ...look }
          : {
              spec: {
                name,
                ...look,
                description: description.trim(),
                domains: topics,
                model: DEFAULT_MODEL,
                soul: instructions.trim(),
              },
            };
    create.mutate(input, {
      onSuccess: (agent) => {
        onOpenChange(false);
        onCreated(agent.name);
        setName("");
        setDescription("");
        setDomains("");
        setInstructions("");
        setLook(null);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nuevo bot</DialogTitle>
            <DialogDescription>Un compañero con su propia memoria, chat, rutinas y herramientas. Corre como un perfil de Hermes en tu Mac mini.</DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="blank">Desde cero</TabsTrigger>
              <TabsTrigger value="template">Plantilla</TabsTrigger>
              <TabsTrigger value="yaml">YAML</TabsTrigger>
            </TabsList>

            <TabsContent value="blank" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="bot-name">Nombre</Label>
                <Input id="bot-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="inbox" aria-invalid={Boolean(name) && !validName} />
                {name && !validName && <p className="text-destructive text-xs">Minúsculas, números y guiones; empieza con letra.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-desc">Para qué es</Label>
                <Input id="bot-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mantiene mi correo en cero y me avisa lo urgente" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-soul">Instrucciones</Label>
                <Textarea
                  id="bot-soul"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={"Eres el bot de correo de Iván. Archivas boletines y recibos, redactas respuestas a lo rutinario y nunca envías sin que te diga."}
                  className="min-h-32"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-domains">Temas que le tocan</Label>
                <Input id="bot-domains" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="correo, inbox, borrador" />
              </div>
              <div className="space-y-2">
                <Label>Cara</Label>
                <LookPicker name={name} value={look} onChange={setLook} recommendation={recommended.data} />
              </div>
            </TabsContent>

            <TabsContent value="template" className="space-y-4 pt-3">
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger className="w-full" aria-label="Plantilla">
                  <SelectValue placeholder="Elige una plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {templates.data?.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <div className="bg-background space-y-2 rounded-md border p-3 text-sm">
                  <p>{selected.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.domains.slice(0, 8).map((d) => (
                      <Badge key={d} variant="secondary" className="font-normal">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {template && <LookPicker name={name || template} value={look} onChange={setLook} recommendation={recommended.data} />}
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Nombre</Label>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder={selected?.name ?? "el de la plantilla"} />
              </div>
            </TabsContent>

            <TabsContent value="yaml" className="space-y-2 pt-3">
              <Textarea value={yaml} onChange={(e) => setYaml(e.target.value)} className="min-h-80 font-mono text-[13px]" spellCheck={false} aria-label="Spec en YAML" />
              <p className="text-muted-foreground text-xs">Mismo formato que templates/*.yaml, con packs y presupuesto.</p>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Crear bot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
