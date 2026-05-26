import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@agentic-os/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@agentic-os/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@agentic-os/providers": path.resolve(__dirname, "../../packages/providers/src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    chunkSizeWarningLimit: 2000,
    minify: mode === 'development' ? false : true,
    sourcemap: mode === 'development',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
}))
