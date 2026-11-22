import { RotateCcw } from "lucide-react";
import { AVATAR_COLORS, AVATAR_IDS, shapeName } from "@/avatars";
import { BotAvatar } from "@/components/bot-avatar";
import { Button } from "@/components/ui/button";
import type { LookRecommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ChosenLook {
  avatar: string;
  color: string;
}

/**
 * Shape and color for a bot. `value` null means "go with the recommendation": the picker shows it, and the
 * backend applies the same one if the bot is created without a look.
 */
export function LookPicker({
  name,
  value,
  onChange,
  recommendation,
}: {
  name: string;
  value: ChosenLook | null;
  onChange: (look: ChosenLook | null) => void;
  recommendation?: LookRecommendation;
}) {
  const look = value ?? recommendation ?? null;
  const pick = (part: Partial<ChosenLook>) => {
    if (!look) return;
    const next = { avatar: look.avatar, color: look.color, ...part };
    onChange(recommendation && next.avatar === recommendation.avatar && next.color === recommendation.color ? null : next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="bg-background grid size-20 shrink-0 place-items-center rounded-2xl border">
          {look && <BotAvatar name={name || "nuevo"} avatar={look.avatar} color={look.color} size={64} live />}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{look ? shapeName(look.avatar) : "Eligiendo…"}</p>
          {recommendation &&
            (value ? (
              <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7" onClick={() => onChange(null)}>
                <RotateCcw />
                Volver al recomendado
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">
                {recommendation.because ? `Recomendado por “${recommendation.because}”.` : "Recomendado. Cuéntame para qué es y lo ajusto a su tema."}
              </p>
            ))}
        </div>
      </div>

      <div role="radiogroup" aria-label="Forma" className="grid grid-cols-8 gap-1">
        {AVATAR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={look?.avatar === id}
            aria-label={shapeName(id)}
            title={shapeName(id)}
            onClick={() => pick({ avatar: id })}
            className={cn(
              "hover:bg-accent focus-visible:ring-ring grid aspect-square place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none",
              look?.avatar === id && "bg-accent ring-foreground/70 ring-1",
            )}
          >
            <BotAvatar name={id} avatar={id} color={look?.color} size={28} />
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5">
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={look?.color === c}
            aria-label={`Color ${c}`}
            onClick={() => pick({ color: c })}
            className={cn(
              "focus-visible:ring-ring size-6 rounded-full ring-offset-2 ring-offset-[var(--popover)] transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:outline-none",
              look?.color === c && "ring-foreground ring-2",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
