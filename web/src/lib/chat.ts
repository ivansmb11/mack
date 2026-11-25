import { useState } from "react";

export const messageGap = (first: boolean, sameAuthor: boolean) => (first ? "" : sameAuthor ? "mt-1" : "mt-5");

export const enterAnimation = "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out";

/**
 * Ids that arrived after the chat first loaded, so only new messages animate in.
 * Resets when `scope` (the chat being shown) changes.
 */
export function useFreshIds<T extends string | number>(scope: string, ids: T[] | undefined): (id: T) => boolean {
  const [initial, setInitial] = useState<{ scope: string; ids: Set<T> } | null>(null);
  if (ids && initial?.scope !== scope) setInitial({ scope, ids: new Set(ids) });
  return (id) => initial?.scope === scope && !initial.ids.has(id);
}
