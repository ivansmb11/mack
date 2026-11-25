# Design — Mack control plane

The locked design system for `web/`. Every screen reads this file before it changes.
Extend or amend it here; don't override it per screen.

## System
- Design system · **Vercel Geist** (https://vercel.com/geist/introduction). Colour scales, type scale, materials, focus ring and button sizes follow Geist; values are copied verbatim from Geist's published CSS.
- Brief · audience = Iván, the single operator · use = see what Mack, the bots and the Factory are doing at a glance, then act (chat, dispatch, queue a job) · tone = utilitarian, technical, quiet
- Theme · neutral grays, black/white primary, colour only for meaning (blue = running/links/focus, green = ok, amber = warning, red = error). Light by default, dark on demand.
- Signature element · the **live status strip** in the top bar (Mack, bots up, Factory slots, month spend). Boldness is spent there; everything else stays quiet.

## Macrostructure (app)
- Cockpit shell that fits one landscape screen at 1440×900: top bar · left rail · main pane. Only panes scroll, never the document.
- Left rail: system sections first (Resumen, Matrix, Factory, Ledger), then chats (bots, then groups). "Nuevo" sits on the same row as the "Chats" heading.
- Operational pages split **list | detail** (Factory). Below 900 px they stack and the rail becomes a drawer.
- No decorative illustrations, glows, grids or gradients. Function carries the page.

## Tokens
Geist scales live in `web/src/index.css` as `--ds-*` (`:root` light, `.dark` dark) and are exposed as Tailwind colours:
`gray-100…1000`, `gray-alpha-100…1000`, `blue-*`, `red-*`, `amber-*`, `green-*`, `background-100`, `background-200`.

Geist step meaning, for every scale:

| Step | Use |
|---|---|
| 100 / 200 / 300 | default / hover / active fill |
| 400 / 500 / 600 | default / hover / active border |
| 700 / 800 | solid high-contrast fill / its hover |
| 900 | secondary text and icons |
| 1000 | primary text and icons |

Use `gray` by default; `gray-alpha` only where the surface underneath should show through (hover fills, borders on mixed surfaces, shadows).

The shadcn names used by `components/ui` point at Geist steps:

| Token | Geist step |
|---|---|
| `--background` | background-200 (page) |
| `--card`, `--popover` | background-100 |
| `--foreground` | gray-1000 |
| `--muted-foreground` | gray-900 |
| `--primary` / `--primary-foreground` | gray-1000 / background-100 (black button in light, white in dark) |
| `--secondary`, `--muted` | gray-100 |
| `--accent` (hover) | gray-alpha-200 |
| `--border`, `--input` | gray-alpha-400 |
| `--ring` | blue-700 (blue-900 in dark) |
| `--destructive` | red-800 |
| `--ok` / `--warn` / `--info` | green-700 / amber-700 / blue-700 — dots only |

Status text uses the 900 step (`text-blue-900`, `text-green-900`, `text-amber-900`, `text-red-900`), never 700, to keep contrast. Status badges use Geist's subtle form: 200 fill + 900 text (`<Badge variant="blue">`).

## Typography
- Geist Sans for everything; Geist Mono for ids, branches, paths, commands, numbers that line up.
- Geist classes are available as utilities: `text-heading-{32,24,20,16,14}`, `text-label-{16,14,13,12}`, `text-copy-{16,14,13}`, `text-button-{16,14,12}`.
- Page title = heading-24 (`h1`), section = heading-16 (`h2`), sub-section = heading-14 (`h3`), body = copy-14, meta = label-12.
- Sentence case everywhere. No all-caps eyebrows.

## Space and shape (Geist materials)
- 4 px scale (Tailwind defaults). Pane padding 20–24 px.
- Radius: 6 px for buttons, inputs and small surfaces (`rounded-md`); 12 px for cards, menus, popovers, dialogs (`rounded-xl`); 16 px fullscreen; full pill only for badges.
- Elevation: surfaces are a 1 px `gray-alpha-400` border, no shadow. Floating layers use Geist shadows: `shadow-md` = menu, `shadow-lg` = modal (each includes its own border ring, so don't add `border`).
- Focus: Geist focus ring (`shadow-focus`: 2 px background gap + 2 px blue).
- Buttons: small 32 px (`size="sm"`), medium 40 px (default), large 48 px. Variants: default (black/white), secondary/outline (bordered), ghost (tertiary), destructive (red-800).

## Motion
- Colour/opacity transitions 150 ms, `ease-out` (Geist). Running jobs show a slow pulse on their dot only.
- `prefers-reduced-motion`: no pulse, no transitions.

## Copy
- Spanish, second person, verbs that say what happens: "Encolar trabajo", "Despachar", "Hablar con Mack".
- Empty states invite the next action. Errors say how to fix it.

## Exports
The source of truth is `web/src/index.css`. Do not hand-pick new colours; pick a Geist scale and step.
