import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    // O preset fica aqui, e não numa variável de ambiente (NITRO_PRESET), por
    // dois motivos: o destino deste projeto é sempre a Cloudflare, e definir a
    // variável no Windows exigia o `cross-env` — que a política de grupo da
    // máquina do Lucas bloqueia, impedindo qualquer build local.
    nitro({ preset: "cloudflare-module" }),
    viteReact(),
  ],
});
