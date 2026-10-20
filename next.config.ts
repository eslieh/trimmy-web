import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The standard rendering model: pages that read the session render per
  // request; public reads (Explore, business pages) cache with `revalidate`.
  // (Cache Components is off so every page doesn't need its own Suspense
  // boundaries around session reads.)
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Business photos (Cloudflare R2, public URLs) and any https image the API returns.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
