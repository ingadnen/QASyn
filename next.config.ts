import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/prisma/*.db*", "**/.git/**"],
    };
    return config;
  },
};

export default nextConfig;
