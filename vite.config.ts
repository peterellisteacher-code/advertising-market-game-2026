import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  publicDir: "web/public",
  build: {
    emptyOutDir: false,
    outDir: "build/studio",
    lib: {
      entry: resolve(import.meta.dirname, "web/src/main.ts"),
      name: "AdMarketCreatorBundle",
      formats: ["iife"],
      fileName: () => "studio.js",
      cssFileName: "studio"
    }
  }
});
