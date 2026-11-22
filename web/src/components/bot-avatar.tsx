import { useEffect, useMemo, useRef } from "react";
import { type AvatarDefinition, type AvatarState, renderAvatarSvg } from "open-bot-avatar";
import { type MountedAvatar, mountAvatar } from "open-bot-avatar/dom";
import { AVATAR_COLORS, AVATAR_IDS, AVATARS } from "@/avatars";
import { MackMark } from "@/components/mack-mark";
import { cn } from "@/lib/utils";

export interface Look {
  avatar?: string | null;
  color?: string | null;
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** The backend always sends a look; these fallbacks only cover a bot that's mid-creation or since deleted. */
export const botColor = (name: string, color?: string | null) => color || AVATAR_COLORS[hash(name) % AVATAR_COLORS.length];
const botShape = (name: string, avatar?: string | null): AvatarDefinition =>
  AVATARS[avatar ?? ""] ?? AVATARS[AVATAR_IDS[hash(name) % AVATAR_IDS.length]];

/** Rendering a still is ~16 KB of path math; lists show the same few faces over and over. */
const stills = new Map<string, string>();
function stillSvg(definition: AvatarDefinition, color: string) {
  const key = `${definition.id}|${color}`;
  if (!stills.has(key)) stills.set(key, renderAvatarSvg(definition, { color, reducedMotion: true }).replace(/<title>.*?<\/title>/, "").replace(/ role="img" aria-label="[^"]*"/, ""));
  return stills.get(key)!;
}

function LiveAvatar({ definition, color, state, size, followPointer }: { definition: AvatarDefinition; color: string; state: AvatarState; size: number; followPointer: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  useEffect(() => {
    avatar.current = mountAvatar(host.current!, { definition, color, state, followPointer, label: "" });
    return () => {
      avatar.current?.destroy();
      avatar.current = null;
    };
    // Mounted once; later changes go through update() so state changes ease instead of jumping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    avatar.current?.update({ definition, color, state, followPointer });
  }, [definition, color, state, followPointer]);
  return <span ref={host} className="block shrink-0" style={{ width: size, height: size }} aria-hidden />;
}

/**
 * A bot's face, drawn with open-bot-avatar. Pass `state` (or `live`) to animate it: eyes blink and follow the
 * pointer, and states like "thinking" or "working" show what it's doing. Without either it's a static SVG.
 */
export function BotAvatar({
  name,
  avatar,
  color,
  size = 36,
  state,
  live = false,
  className,
}: { name: string; size?: number; state?: AvatarState; live?: boolean; className?: string } & Look) {
  const definition = botShape(name, avatar);
  const fill = botColor(name, color);
  const svg = useMemo(() => (live || state ? "" : stillSvg(definition, fill)), [definition, fill, live, state]);

  if (name === "mack")
    return (
      <span
        className={cn("bg-background grid shrink-0 place-items-center rounded-full ring-1 ring-[color-mix(in_oklab,var(--signal)_45%,transparent)]", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <MackMark style={{ width: size * 0.62, height: size * 0.62 }} />
      </span>
    );

  if (live || state)
    return (
      <span className={cn("shrink-0", className)}>
        <LiveAvatar definition={definition} color={fill} state={state ?? "idle"} size={size} followPointer={live} />
      </span>
    );

  return (
    <span
      className={cn("block shrink-0 [&>svg]:size-full", className)}
      style={{ width: size, height: size }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function GroupAvatar({ members, looks, size = 36 }: { members: string[]; looks: Record<string, Look | undefined>; size?: number }) {
  const shown = members.slice(0, 3);
  const face = size * 0.6;
  const spots = [
    { left: 0, top: size - face },
    { left: size - face, top: size - face },
    { left: (size - face) / 2, top: 0 },
  ];
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {shown.map((m, i) => (
        <span key={m} className="absolute" style={spots[i]}>
          <BotAvatar name={m} {...looks[m]} size={face} />
        </span>
      ))}
    </span>
  );
}
