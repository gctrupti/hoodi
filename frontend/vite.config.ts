import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import path from "node:path";

export default defineConfig({
  server: { port: 8080, host: true },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // Redirect the bundled server entry to src/server.ts (SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
  ],
});
