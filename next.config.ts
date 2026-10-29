import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  compress: true,
  reactStrictMode: false,
};

export default nextConfig;
