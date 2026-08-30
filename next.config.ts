import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CODEX_TEST_DIST_DIR,
};

export default nextConfig;
