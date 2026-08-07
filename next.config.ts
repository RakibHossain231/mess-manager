import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project folder. Otherwise Next.js
  // can infer the parent OneDrive folder as the root and fail to resolve
  // packages like `tailwindcss`, which sends dev into a crash/retry loop.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
