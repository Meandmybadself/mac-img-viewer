import { defineConfig } from "vite";

// Tauri expects a fixed port and serves the frontend from `dist`.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "safari15",
    outDir: "dist",
    emptyOutDir: true,
  },
});
