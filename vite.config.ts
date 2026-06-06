import { defineConfig } from "vite";

// Plain Vite config. We keep dependencies minimal and hand-roll the PWA
// service worker + manifest so the project installs cleanly even on
// restricted networks.
export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
