import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There's another package-lock.json in the home folder; pin the project root explicitly.
  outputFileTracingRoot: process.cwd(),
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
