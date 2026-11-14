import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      // `server-only` throws outside a Next.js server build.
      "server-only": path("./src/test/server-only.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
