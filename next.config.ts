import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hooks lint runs with `npm run lint`; keep the build itself unchanged.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
