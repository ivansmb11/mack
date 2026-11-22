import { useEffect, useState } from "react";

export const PAGES = ["resumen", "matrix", "factory", "ledger"] as const;
export type Page = (typeof PAGES)[number];

export type Route = { view: "bot"; name: string } | { view: "group"; id: string } | { view: Page };

export const DEFAULT_ROUTE: Route = { view: "bot", name: "mack" };

function parse(): Route {
  const [head, arg] = window.location.hash.replace(/^#\/?/, "").split("/");
  if (head === "bot" && arg) return { view: "bot", name: decodeURIComponent(arg) };
  if (head === "grupo" && arg) return { view: "group", id: decodeURIComponent(arg) };
  return PAGES.includes(head as Page) ? { view: head as Page } : DEFAULT_ROUTE;
}

export const toHash = (r: Route) =>
  r.view === "bot" ? `/bot/${encodeURIComponent(r.name)}` : r.view === "group" ? `/grupo/${encodeURIComponent(r.id)}` : `/${r.view}`;

export const sameRoute = (a: Route, b: Route) => toHash(a) === toHash(b);

/** Hash routing keeps every view reachable without server-side fallback routes on the control plane. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return [route, (r) => (window.location.hash = toHash(r))];
}
