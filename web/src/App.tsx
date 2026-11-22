import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { TokenGate } from "@/components/token-gate";
import { useHashRoute } from "@/hooks/use-hash-route";
import { onUnauthorized, tokenStore } from "@/lib/api";
import { BotChatView } from "@/views/bot-chat";
import { FactoryView } from "@/views/factory";
import { GroupChatView } from "@/views/group-chat";
import { LedgerView } from "@/views/ledger";
import { MatrixView } from "@/views/matrix";
import { OverviewView } from "@/views/overview";

export function App() {
  const [authed, setAuthed] = useState(() => Boolean(tokenStore.get()));
  const [route, navigate] = useHashRoute();
  const qc = useQueryClient();

  const logout = () => {
    tokenStore.clear();
    qc.clear();
    setAuthed(false);
  };
  useEffect(() => onUnauthorized(logout));

  if (!authed) return <TokenGate onReady={() => setAuthed(true)} />;

  return (
    <Shell route={route} onNavigate={navigate} onLogout={logout}>
      {route.view === "bot" && <BotChatView key={route.name} name={route.name} />}
      {route.view === "group" && <GroupChatView key={route.id} id={route.id} />}
      {route.view === "resumen" && <OverviewView onNavigate={navigate} />}
      {route.view === "matrix" && <MatrixView />}
      {route.view === "factory" && <FactoryView />}
      {route.view === "ledger" && <LedgerView />}
    </Shell>
  );
}
