import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin workspace root ke folder proyek ini. Tanpa ini, Next.js bisa salah
// mendeteksi root karena ada lockfile lain di direktori home.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
