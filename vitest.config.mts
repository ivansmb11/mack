import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Nest resolves constructor injection from decorator metadata, which esbuild does not emit.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { include: ["test/**/*.spec.ts"], pool: "forks" },
});
