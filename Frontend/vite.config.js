import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

// In dev, /api is proxied to the backend so there are no CORS issues.
// The backend port comes from PORT in the project's root .env (same one the backend uses),
// or set BACKEND_URL to point somewhere else entirely.
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(here, ".."), "");
  const localEnv = loadEnv(mode, here, "");
  const target = localEnv.BACKEND_URL || rootEnv.BACKEND_URL || `http://localhost:${rootEnv.PORT || 3000}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target, changeOrigin: true },
      },
    },
  };
});
