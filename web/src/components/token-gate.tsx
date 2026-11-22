import { KeyRound, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { MackMark } from "@/components/mack-mark";
import { GlowArc } from "@/components/visuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tokenStore, verifyToken } from "@/lib/api";

export function TokenGate({ onReady }: { onReady: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    const ok = await verifyToken(token.trim()).catch(() => false);
    setChecking(false);
    if (!ok) return setError("Ese token no abre el control plane. Revisa MACK_TOKEN en ~/.mack/.env.");
    tokenStore.set(token.trim());
    onReady();
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-6">
      <div className="blueprint pointer-events-none absolute inset-0" aria-hidden />
      <GlowArc className="pointer-events-none absolute top-[8%] left-1/2 w-[min(520px,90vw)] -translate-x-1/2 opacity-70" />
      <form onSubmit={submit} className="bg-card/80 crosshairs relative w-full max-w-sm space-y-6 rounded-lg border p-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <MackMark className="size-10" />
          <div>
            <h1>Mack</h1>
            <p className="text-muted-foreground text-sm">Tu agente en el Mac mini</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="token">Token de acceso</Label>
          <Input
            id="token"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="font-mono"
          />
          <p className="text-muted-foreground text-sm">
            Cópialo en el Mac mini con <code className="font-mono text-[13px]">grep MACK_TOKEN ~/.mack/.env</code>
          </p>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={!token.trim() || checking}>
          {checking ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Entrar
        </Button>
      </form>
    </main>
  );
}
