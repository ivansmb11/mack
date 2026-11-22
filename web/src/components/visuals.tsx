import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, from: number, to: number) => {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
};

/** Evenly spread n angles inside [from, to], keeping a margin from both ends. */
const spread = (n: number, from: number, to: number) =>
  Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 1)) / (n + 1));

/** The luminous arch from the reference: blue→violet crown, amber glow pooling at both feet. */
export function GlowArc({ className }: { className?: string }) {
  const id = useId();
  const arch = "M 90 230 L 90 150 A 160 120 0 0 1 410 150 L 410 230";
  return (
    <svg viewBox="0 0 500 300" overflow="visible" className={cn("pointer-events-none", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-crown`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="0.5" stopColor="var(--signal)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
        <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="140" y2="232">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="-100" y="-100" width="700" height="500">
          <rect x="-100" y="-100" width="700" height="500" fill={`url(#${id}-fade)`} />
        </mask>
        <filter id={`${id}-soft`} filterUnits="userSpaceOnUse" x="-100" y="-100" width="700" height="500">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${id}-pool`} filterUnits="userSpaceOnUse" x="-100" y="-100" width="700" height="500">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-pool)`} opacity="0.9">
        <ellipse cx="90" cy="200" rx="34" ry="46" fill="var(--forge)" />
        <ellipse cx="410" cy="200" rx="34" ry="46" fill="var(--forge)" />
      </g>
      <g mask={`url(#${id}-mask)`}>
        <path d={arch} fill="none" stroke={`url(#${id}-crown)`} strokeWidth="46" filter={`url(#${id}-soft)`} opacity="0.55" />
        <path d={arch} fill="none" stroke={`url(#${id}-crown)`} strokeWidth="24" />
      </g>
    </svg>
  );
}

/** Circular node with the reference's amber→blue gradient ring. */
export function GlowRing({ children, size = 72, tone = "signal", className }: { children?: ReactNode; size?: number; tone?: "signal" | "forge"; className?: string }) {
  const ring =
    tone === "signal"
      ? "conic-gradient(from 210deg, var(--forge), var(--signal) 35%, var(--violet) 70%, var(--forge))"
      : "conic-gradient(from 210deg, var(--forge), #ffd29a 40%, var(--forge) 70%, #7a4a12)";
  return (
    <div className={cn("relative grid shrink-0 place-items-center rounded-full", className)} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full opacity-50 blur-md" style={{ background: ring }} />
      <div className="absolute inset-0 rounded-full p-[3px]" style={{ background: ring }}>
        <div className="bg-background size-full rounded-full" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

export interface FanNode {
  id: string;
  label: string;
  active: boolean | undefined;
}

/** Matrix as a radar fan: Mack's hub at the base, each DSA a blip on the rings. */
export function RadialFan({ nodes, hub }: { nodes: FanNode[]; hub: ReactNode }) {
  const id = useId();
  const cx = 150;
  const cy = 162;
  const radii = [44, 82, 120, 150];
  const visible = nodes.slice(0, 9);
  const angles = spread(visible.length, 200, 340);

  return (
    <div className="relative">
      <svg viewBox="0 0 300 172" className="w-full" aria-hidden>
        <defs>
          <radialGradient id={`${id}-sweep`} cx="0.5" cy="0.94" r="0.9">
            <stop offset="0" stopColor="var(--signal)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--signal)" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-glow`}>
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <path d={`${arcPath(cx, cy, 150, 180, 360)} L ${cx} ${cy} Z`} fill={`url(#${id}-sweep)`} />
        {radii.map((r) => (
          <path key={r} d={arcPath(cx, cy, r, 180, 360)} fill="none" stroke="var(--input)" strokeWidth="1" />
        ))}
        {[210, 240, 270, 300, 330].map((deg) => {
          const end = polar(cx, cy, 150, deg);
          return <line key={deg} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="var(--grid)" strokeWidth="1" />;
        })}
        {visible.map((node, i) => {
          const r = radii[i % 2 === 0 ? 2 : 1];
          const p = polar(cx, cy, r, angles[i]);
          const label = polar(cx, cy, r + 15, angles[i]);
          const color = node.active ? "var(--signal)" : node.active === false ? "var(--destructive)" : "var(--muted-foreground)";
          return (
            <g key={node.id}>
              <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={color} strokeOpacity={node.active ? 0.55 : 0.2} strokeWidth="1" />
              {node.active && <circle cx={p.x} cy={p.y} r="7" fill={color} filter={`url(#${id}-glow)`} />}
              <circle cx={p.x} cy={p.y} r="3.5" fill={color} />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill="var(--muted-foreground)">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3">{hub}</div>
    </div>
  );
}

export interface OrbitNode {
  id: string;
  label: string;
  tone: "running" | "done" | "failed" | "idle";
}

const ORBIT_COLOR: Record<OrbitNode["tone"], string> = {
  running: "var(--forge)",
  done: "var(--ok)",
  failed: "var(--destructive)",
  idle: "var(--muted-foreground)",
};

/** Factory as an orbit: recent jobs travel the arc around the forge, running ones glow amber. */
export function OrbitArc({ nodes, hub }: { nodes: OrbitNode[]; hub: ReactNode }) {
  const id = useId();
  const cx = 150;
  const cy = 178;
  const visible = nodes.slice(0, 6);
  const angles = spread(visible.length, 196, 344);

  return (
    <div className="relative">
      <svg viewBox="0 0 300 172" className="w-full" aria-hidden>
        <defs>
          <linearGradient id={`${id}-arc`} x1="0" x2="1">
            <stop offset="0" stopColor="var(--forge)" stopOpacity="0.1" />
            <stop offset="0.5" stopColor="var(--forge)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--forge)" stopOpacity="0.1" />
          </linearGradient>
          <filter id={`${id}-glow`}>
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <path d={arcPath(cx, cy, 138, 186, 354)} fill="none" stroke={`url(#${id}-arc)`} strokeWidth="1.5" />
        <path d={arcPath(cx, cy, 104, 192, 348)} fill="none" stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 5" />
        {visible.map((node, i) => {
          const p = polar(cx, cy, 138, angles[i]);
          const label = polar(cx, cy, 120, angles[i]);
          const color = ORBIT_COLOR[node.tone];
          return (
            <g key={node.id}>
              <line
                x1={cx}
                y1={cy - 30}
                x2={p.x}
                y2={p.y}
                stroke={color}
                strokeOpacity={node.tone === "running" ? 0.7 : 0.18}
                strokeDasharray={node.tone === "running" ? "4 4" : undefined}
                style={node.tone === "running" ? { animation: "cable-flow 0.9s linear infinite" } : undefined}
              />
              {node.tone === "running" && <circle cx={p.x} cy={p.y} r="8" fill={color} filter={`url(#${id}-glow)`} />}
              <circle cx={p.x} cy={p.y} r="4" fill="var(--background)" stroke={color} strokeWidth="2" />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--muted-foreground)">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4">{hub}</div>
    </div>
  );
}

/** Concentric halo for the Mack card, echoing the reference's first panel. */
export function Halo({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid h-[172px] place-items-center">
      {[150, 112, 76].map((d) => (
        <div key={d} className="border-grid absolute rounded-full border" style={{ width: d, height: d }} />
      ))}
      <div className="bg-signal/20 absolute size-24 rounded-full blur-2xl" />
      {children}
    </div>
  );
}
