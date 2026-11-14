import type { NextConfig } from "next";

// Cache Components is deliberately off: every signed-in page is derived from
// one person's health data, so pages render per request and nothing is
// prerendered or shared between users.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
