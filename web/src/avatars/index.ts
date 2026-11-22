import { type AvatarDefinition, examples } from "open-bot-avatar";

const gallery = import.meta.glob<AvatarDefinition>("./gallery/*.json", { eager: true, import: "default" });

/** Every shape a bot can wear, by id; the backend recommends from the same ids (src/dsa/avatars.ts). */
export const AVATARS: Record<string, AvatarDefinition> = Object.fromEntries(
  [...examples, ...Object.values(gallery)].map((d) => [d.id, d]),
);

/** open-bot-avatar's editor palette. */
export const AVATAR_COLORS = ["#f4f4f4", "#a8693f", "#f2384b", "#ff6a1a", "#f8a01c", "#1fbf68", "#14b3a5", "#1f7cf2", "#8b5cf6", "#ec4899", "#7a7a7a"];

const SHAPE_NAMES: Record<string, string> = {
  bull: "Toro",
  "witch-hat": "Sombrero de mago",
  cloud: "Nube",
  shield: "Escudo",
  brain: "Cerebro",
  magnifier: "Lupa",
  book: "Libro",
  rocket: "Cohete",
  chat: "Globo de diálogo",
  lightbulb: "Foco",
  "paint-brush": "Pincel",
  palette: "Paleta",
  camera: "Cámara",
  barbell: "Pesa",
  egg: "Huevo",
  mug: "Taza",
  sprout: "Brote",
  "watering-can": "Regadera",
  cat: "Gato",
  bunny: "Conejo",
  controller: "Control",
  star: "Estrella",
  ghost: "Fantasma",
};

/** Shapes in the order the backend weighs them, so the picker groups work-like shapes first. */
export const AVATAR_IDS = Object.keys(SHAPE_NAMES).filter((id) => id in AVATARS);

export const shapeName = (id: string) => SHAPE_NAMES[id] ?? AVATARS[id]?.name ?? id;
