import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { BotAvatar } from "@/components/bot-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBots, useGroupMutations } from "@/hooks/queries";

export function NewGroupDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const bots = useBots();
  const { create } = useGroupMutations();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), members },
      {
        onSuccess: (g) => {
          onOpenChange(false);
          onCreated(g.id);
          setName("");
          setMembers([]);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nuevo grupo</DialogTitle>
            <DialogDescription>Junta bots en un chat. Contesta quien mencionas con @, y se pasan el trabajo entre ellos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-group-name">Nombre</Label>
            <Input id="new-group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lanzamiento" />
          </div>
          <fieldset className="max-h-72 space-y-1 overflow-y-auto">
            <legend className="mb-2 text-sm font-medium">Integrantes</legend>
            {bots.data?.map((b) => (
              <label key={b.name} className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5">
                <BotAvatar name={b.name} avatar={b.avatar} color={b.color} size={26} />
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <Switch
                  checked={members.includes(b.name)}
                  onCheckedChange={(on) => setMembers(on ? [...members, b.name] : members.filter((m) => m !== b.name))}
                  aria-label={b.name}
                />
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || !members.length || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Crear grupo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
