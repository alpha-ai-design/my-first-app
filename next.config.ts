import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hooks lint runs with `npm run lint`; keep the build itself unchanged.
  eslint: { ignoreDuringBuilds: true },
  // The service worker must never be served from the browser's cache, so updates reach phones at once.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
