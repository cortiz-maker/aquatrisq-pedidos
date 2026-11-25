import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Identificador único de cada build. La app lo compara con /version.json para
// avisar cuando hay una versión nueva publicada (pestañas abiertas desde antes).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    {
      name: "aq-version-json",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
});
