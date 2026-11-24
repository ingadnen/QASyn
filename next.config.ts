import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep a prod build in its own dist dir so the dev server (managed preview)
  // cannot clobber .next while `next start` is serving from it.
  distDir: process.env.QASYN_PROD_DIST_DIR ? ".next-prod" : ".next",
  allowedDevOrigins: ["*.vercel.run", "vercel.run", "127.0.0.1", "localhost"],
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    // Phase 11 — permanent migration from the legacy product route.
    return [
      { source: "/ship", destination: "/qasyn", permanent: true },
      { source: "/dashboard/ship", destination: "/dashboard/qasyn", permanent: true },
    ];
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/prisma/*.db*", "**/.git/**"],
    };
    return config;
  },
};

export default nextConfig;
