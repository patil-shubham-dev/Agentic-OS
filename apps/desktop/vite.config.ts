import { defineConfig } from "vitest/config"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@agentic-os/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@agentic-os/providers": path.resolve(__dirname, "../../packages/providers/src"),
      "@agentic-os/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
})
