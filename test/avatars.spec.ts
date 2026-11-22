import { afterEach, describe, expect, it } from "vitest";
import { recommendLook } from "../src/dsa/avatars.js";
import { createTestApp, dsaSpec } from "./helpers.js";

let t: Awaited<ReturnType<typeof createTestApp>>;
afterEach(() => t?.app.close());

describe("recommendLook", () => {
  it("picks the shape that fits the bot's topics and says why", () => {
    expect(recommendLook({ name: "finanzas", domains: ["gastos", "inversiones"] })).toEqual({ avatar: "bull", color: "#1fbf68", because: "finanzas" });
    expect(recommendLook({ name: "dev", description: "Revisa código TypeScript" })).toMatchObject({ avatar: "witch-hat" });
    expect(recommendLook({ name: "abogada", domains: ["contratos", "legal"] })).toMatchObject({ avatar: "shield", because: "abogada" });
  });

  it("doesn't mistake research for investing", () => {
    expect(recommendLook({ name: "x", domains: ["investigacion"] }).avatar).toBe("magnifier");
  });

  it("falls back to a stable shape when nothing matches", () => {
    const look = recommendLook({ name: "zorg" });
    expect(look.because).toBeNull();
    expect(recommendLook({ name: "zorg" })).toEqual(look);
  });

  it("shifts the color when another bot already wears that look", () => {
    expect(recommendLook({ name: "finanzas" }, [{ avatar: "bull", color: "#1FBF68" }]).color).toBe("#14b3a5");
  });
});

describe("Bot looks", () => {
  it("gives a new bot the recommended look unless one was chosen", async () => {
    t = await createTestApp();
    await t.api.post("/api/agents", dsaSpec());
    await t.api.post("/api/agents", dsaSpec({ name: "dinero", avatar: "cat", color: "#ec4899" }));

    const recommended = await t.api.post("/api/agents/recommend-look", { name: "ahorro", domains: ["presupuesto"] });
    const agents = (await t.api.get("/api/agents")).body;

    expect(agents.find((a: { name: string }) => a.name === "finanzas")).toMatchObject({ avatar: "bull", color: "#1fbf68" });
    expect(agents.find((a: { name: string }) => a.name === "dinero")).toMatchObject({ avatar: "cat", color: "#ec4899" });
    expect(recommended.body).toMatchObject({ avatar: "bull", color: "#14b3a5" });
  });

  it("rejects shapes that don't exist", async () => {
    t = await createTestApp();
    expect((await t.api.post("/api/agents", dsaSpec({ avatar: "dragon" }))).status).toBe(400);
  });
});
