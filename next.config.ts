import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for build (needed for pdf-parse compatibility)
  turbopack: {},
  webpack: (config) => {
    // pdf-parse requires canvas which is optional
    config.resolve.alias.canvas = false;
    return config;
  },
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
