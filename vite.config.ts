import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Expose the build commit and timestamp at compile time so the rendered
// bundle carries its own provenance — handy for confirming whether a
// browser is showing the latest deploy or a stale cached version.
const BUILD_COMMIT =
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GIT_COMMIT ||
  process.env.SOURCE_VERSION ||
  "dev";
const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  define: {
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT.slice(0, 7)),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
