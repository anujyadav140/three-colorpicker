import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',       // static‐export mode
  assetPrefix: './',      // make all JS/CSS/model refs relative
  trailingSlash: true,    // each page in its own folder (optional)
};

export default nextConfig;
