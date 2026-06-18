import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: repoRoot
  },
  transpilePackages: ["@dash/ui"]
};

export default nextConfig;
