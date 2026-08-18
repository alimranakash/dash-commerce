import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Uploads go through a server action, whose body defaults to 1MB. Sized
      // above the largest media cap so an over-limit file is refused by the
      // media rules, with their explanatory message, rather than by Next.
      bodySizeLimit: "8mb"
    }
  },
  reactStrictMode: true,
  turbopack: {
    root: repoRoot
  },
  transpilePackages: ["@dash/ui"]
};

export default nextConfig;
