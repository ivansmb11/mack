import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  // Dev server proxies the control plane so `npm run dev` works against a running Mack.
  server: { proxy: { "/api": "http://127.0.0.1:7777", "/v1": "http://127.0.0.1:7777", "/healthz": "http://127.0.0.1:7777" } },
});
