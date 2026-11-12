import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
