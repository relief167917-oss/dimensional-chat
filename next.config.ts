import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep turbopack CSS rules for optional `next dev --turbopack`.
  // Default scripts use webpack so server/ TypeScript ESM `.js` imports resolve.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // server/ uses NodeNext-style `.js` imports pointing at `.ts` sources.
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    },
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  serverExternalPackages: ["zod"],
};

export default nextConfig;
