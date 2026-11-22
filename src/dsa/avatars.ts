/**
 * Bot looks: a shape from open-bot-avatar (https://github.com/DominikScholz/open-bot-avatar, MIT) and a body color.
 * The geometry lives in the web app; here we only need the ids and what each shape stands for, to recommend one.
 */

/** open-bot-avatar's editor palette, so recommended colors match what the picker offers. */
export const AVATAR_COLORS = [
  "#f4f4f4",
  "#a8693f",
  "#f2384b",
  "#ff6a1a",
  "#f8a01c",
  "#1fbf68",
  "#14b3a5",
  "#1f7cf2",
  "#8b5cf6",
  "#ec4899",
  "#7a7a7a",
] as const;

interface AvatarShape {
  id: string;
  color: string;
  /** Accent-free, lowercase, Spanish and English stems. */
  keywords: string[];
}

export const AVATAR_SHAPES: AvatarShape[] = [
  { id: "bull", color: "#1fbf68", keywords: ["finanza", "finance", "invers", "investing", "investment", "investor", "bolsa", "stock", "trading", "cripto", "crypto", "dinero", "money", "ahorro", "saving", "presupuesto", "budget", "gasto", "expense", "impuesto", "tax", "contab", "account", "sat", "factura", "banco", "bank"] },
  { id: "witch-hat", color: "#8b5cf6", keywords: ["dev", "codigo", "code", "program", "software", "typescript", "javascript", "python", "ingenier", "engineer", "automat", "script", "bug"] },
  { id: "cloud", color: "#14b3a5", keywords: ["devops", "infra", "cloud", "nube", "servidor", "server", "aws", "gcp", "azure", "deploy", "kubernetes", "docker", "clima", "weather"] },
  { id: "shield", color: "#1f7cf2", keywords: ["segur", "secur", "legal", "abogad", "lawyer", "contrato", "contract", "complian", "privacidad", "privacy", "riesgo", "risk", "proteccion", "insurance", "ley", "law"] },
  { id: "brain", color: "#ec4899", keywords: ["ia", "ai", "ml", "llm", "dato", "data", "analisis", "analytic", "psicolog", "terapia", "therapy", "mental", "memoria", "memory", "conocimiento", "knowledge"] },
  { id: "magnifier", color: "#1f7cf2", keywords: ["busqueda", "search", "investig", "research", "auditor", "audit", "qa", "testing", "tests", "pruebas", "review", "revision", "seo", "debug", "verific"] },
  { id: "book", color: "#a8693f", keywords: ["libro", "book", "lectura", "reading", "estudi", "study", "educa", "escuela", "school", "curso", "course", "docs", "document", "nota", "note", "idioma", "language", "aprend", "learn", "tutor"] },
  { id: "rocket", color: "#ff6a1a", keywords: ["lanzamiento", "launch", "startup", "growth", "marketing", "venta", "sales", "negocio", "business", "emprend", "viaje", "travel", "vuelo", "flight"] },
  { id: "chat", color: "#8b5cf6", keywords: ["comunica", "mensaje", "message", "email", "correo", "mail", "soporte", "support", "cliente", "customer", "atencion", "social", "redes", "community", "comunidad", "whatsapp", "slack"] },
  { id: "lightbulb", color: "#f8a01c", keywords: ["idea", "innova", "creativ", "brainstorm", "estrategia", "strategy", "producto", "product", "planning", "planeacion", "consult"] },
  { id: "paint-brush", color: "#1fbf68", keywords: ["diseno", "design", "ilustra", "ui", "ux", "frontend", "css", "figma", "dibujo", "draw"] },
  { id: "palette", color: "#a8693f", keywords: ["arte", "art", "pintura", "paint", "branding", "marca", "brand", "color", "moda", "fashion", "estilo", "style"] },
  { id: "camera", color: "#7a7a7a", keywords: ["foto", "photo", "video", "contenido", "content", "youtube", "instagram", "tiktok", "media", "podcast", "edicion", "editing"] },
  { id: "barbell", color: "#f2384b", keywords: ["gym", "fitness", "ejercicio", "exercise", "entrena", "train", "workout", "deporte", "sport", "pesas", "correr", "running", "salud", "health", "medic", "doctor"] },
  { id: "egg", color: "#f4f4f4", keywords: ["cocina", "cook", "receta", "recipe", "comida", "food", "nutri", "dieta", "diet", "desayuno", "breakfast", "meal"] },
  { id: "mug", color: "#f4f4f4", keywords: ["cafe", "coffee", "rutina", "routine", "manana", "morning", "productiv", "habito", "habit", "diario", "journal", "agenda", "calendar", "asistente", "assistant", "personal"] },
  { id: "sprout", color: "#1fbf68", keywords: ["crecimiento", "planta", "plant", "sosten", "sustain", "bienestar", "wellness", "meditacion", "meditation", "ecolog"] },
  { id: "watering-can", color: "#14b3a5", keywords: ["jardin", "garden", "riego", "mantenimiento", "maintenance", "hogar", "home", "casa", "house", "limpieza", "cleaning"] },
  { id: "cat", color: "#f8a01c", keywords: ["gato", "cat", "mascota", "pet", "perro", "dog", "veterinar", "vet"] },
  { id: "bunny", color: "#ec4899", keywords: ["nino", "hijo", "kid", "child", "familia", "family", "crianza", "parenting", "bebe", "baby"] },
  { id: "controller", color: "#ff6a1a", keywords: ["juego", "game", "gaming", "videojuego", "esports", "entretenimiento", "entertainment", "ocio", "twitch", "stream"] },
  { id: "star", color: "#f8a01c", keywords: ["meta", "goal", "objetivo", "motiva", "coach", "lider", "leader", "carrera", "career", "logro", "achievement", "calidad", "quality"] },
  { id: "ghost", color: "#f4f4f4", keywords: ["anonimo", "anonymous", "fantasma", "ghost", "nocturno", "night", "misterio", "mystery", "halloween", "scraping", "background"] },
];

export const AVATAR_IDS = AVATAR_SHAPES.map((s) => s.id) as [string, ...string[]];

export interface Look {
  avatar: string;
  color: string;
}

export interface LookRecommendation extends Look {
  /** The word in the bot's name, topics or description that picked the shape; null when nothing matched. */
  because: string | null;
}

const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Short keywords ("ia", "ui", "qa") must match whole words; longer ones also match as prefixes ("invers" → "inversiones"). */
const matches = (word: string, keyword: string) => word === keyword || (keyword.length >= 4 && word.startsWith(keyword));

/**
 * Picks the shape whose keywords best fit the bot (its name counts most, then its topics, then its description)
 * and that shape's color. When another bot already wears that exact look, the color moves along the palette.
 */
export function recommendLook(bot: { name: string; description?: string; domains?: string[] }, taken: Look[] = []): LookRecommendation {
  const weighted: [string, number][] = [
    ...words(bot.name).map((w) => [w, 3] as [string, number]),
    ...(bot.domains ?? []).flatMap(words).map((w) => [w, 2] as [string, number]),
    ...words(bot.description ?? "").map((w) => [w, 1] as [string, number]),
  ];

  let best: { shape: AvatarShape; score: number; because: string } | null = null;
  for (const shape of AVATAR_SHAPES) {
    let score = 0;
    let because = "";
    let top = 0;
    for (const [word, weight] of weighted) {
      if (!shape.keywords.some((k) => matches(word, k))) continue;
      score += weight;
      if (weight > top) [top, because] = [weight, word];
    }
    if (score > (best?.score ?? 0)) best = { shape, score, because };
  }

  const shape = best?.shape ?? AVATAR_SHAPES[hash(bot.name) % AVATAR_SHAPES.length];
  const isTaken = (color: string) => taken.some((l) => l.avatar === shape.id && l.color.toLowerCase() === color);
  const start = AVATAR_COLORS.indexOf(shape.color as (typeof AVATAR_COLORS)[number]);
  const color = [...AVATAR_COLORS.slice(start), ...AVATAR_COLORS.slice(0, start)].find((c) => !isTaken(c)) ?? shape.color;
  return { avatar: shape.id, color, because: best?.because ?? null };
}
