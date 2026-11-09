import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5174,
    strictPort: true,
    open: false,
    // Direct API requests: no proxy and no backend security/CORS changes.
  },
  build: {
    outDir: "dist/admin-catalog",
    emptyOutDir: true,
    rolldownOptions: {
      input: fileURLToPath(new URL("./index.html", import.meta.url)),
    },
  },
});
