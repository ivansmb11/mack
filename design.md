# Design — Mack control plane

The locked design system for `web/`. Every screen reads this file before it changes.
Extend or amend it here; don't override it per screen.

## System
- Genre · modern-minimal (operational cockpit, not a landing page)
- Brief · audience = Iván, the single operator · use = see what Mack, the bots and the Factory are doing at a glance, then act (chat, dispatch, queue a job) · tone = utilitarian, technical, quiet
- Theme · custom, Cobalt family: cool near-white paper, ink near-black, **one** cobalt accent. Light by default, dark on demand.
- Axes · light paper / geometric sans (Geist) / cool accent
- Signature element · the **live status strip** in the top bar (Mack, bots up, Factory slots, month spend). Boldness is spent there; everything else stays quiet.

## Macrostructure (app)
- Cockpit shell that fits one landscape screen at 1440×900: top bar · left rail · main pane. Only panes scroll, never the document.
- Left rail: system sections first (Resumen, Matrix, Factory, Ledger), then chats (bots, then groups). "Nuevo" sits on the same row as the "Chats" heading.
- Operational pages split **list | detail** (Factory). Below 900 px they stack and the rail becomes a drawer.
- No decorative illustrations, glows, grids or gradients. Function carries the page.

## Tokens
Defined once in `web/src/index.css` (`:root` and `.dark`), consumed through the shadcn names
(`--background`, `--foreground`, `--primary`, …) plus three status tokens.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | oklch(98.6% 0.004 250) | oklch(16% 0.01 260) | paper |
| `--card` | oklch(100% 0 0) | oklch(19.5% 0.012 260) | panes, cards |
| `--foreground` | oklch(22% 0.02 260) | oklch(95% 0.006 250) | ink |
| `--muted-foreground` | oklch(50% 0.02 260) | oklch(70% 0.015 255) | secondary text (≥ 4.5:1) |
| `--border` | oklch(91.5% 0.008 255) | oklch(28% 0.014 260) | 1 px rules |
| `--primary` | oklch(52% 0.2 262) | oklch(68% 0.16 262) | cobalt: primary action, focus, active nav, running |
| `--ok` | oklch(58% 0.15 155) | oklch(72% 0.15 155) | online, done |
| `--warn` | oklch(70% 0.15 75) | oklch(80% 0.14 80) | incomplete, budget near the limit |
| `--destructive` | oklch(56% 0.21 27) | oklch(68% 0.18 25) | down, failed |

Status colours appear as dots and short labels, never as filled panels.

## Typography
- Geist Variable for everything; Geist Mono Variable for ids, branches, paths, commands, numbers that line up.
- Scale: page title 22/28 600 · section title 15/20 600 · body 14/20 · meta 12/16. Page title ≥ 1.2 × nav label.
- Sentence case everywhere. Headings upright, tracking −0.015em. No all-caps eyebrows.

## Space and shape
- 4 px scale (Tailwind defaults). Pane padding 20–24 px.
- Radius 8 px for panes and inputs, full pill only for status badges.
- Elevation: 1 px border; no shadows except popovers and dialogs.

## Motion
- Colour/opacity transitions ≤ 150 ms, `ease-out`. Running jobs show a slow pulse on their dot only.
- `prefers-reduced-motion`: no pulse, no transitions.

## Copy
- Spanish, second person, verbs that say what happens: "Encolar trabajo", "Despachar", "Hablar con Mack".
- Empty states invite the next action. Errors say how to fix it.

## Exports

### tokens.css (light)
```css
:root {
  --background: oklch(98.6% 0.004 250);
  --card: oklch(100% 0 0);
  --foreground: oklch(22% 0.02 260);
  --muted-foreground: oklch(50% 0.02 260);
  --border: oklch(91.5% 0.008 255);
  --primary: oklch(52% 0.2 262);
  --ok: oklch(58% 0.15 155);
  --warn: oklch(70% 0.15 75);
  --destructive: oklch(56% 0.21 27);
  --radius: 0.5rem;
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, monospace;
}
```
