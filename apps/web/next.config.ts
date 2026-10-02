import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    "@friday/core", "@friday/db", "@friday/ai", "@friday/vault", "@friday/backup",
    "@friday/notify", "@friday/contracts", "@friday/services",
  ],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
};

export default nextConfig;
