import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin workspace root ke folder proyek ini. Tanpa ini, Next.js bisa salah
// mendeteksi root karena ada lockfile lain di direktori home.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const ngrokOrigins = ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io", "*.ngrok.app"];
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Izinkan akses dev server via tunnel ngrok (HMR/asset dev-only).
  allowedDevOrigins: isDev ? ngrokOrigins : undefined,
  experimental: {
    serverActions: {
      // allowedOrigins juga berlaku di production (proteksi CSRF Server Action) —
      // wildcard ngrok cuma aman dipakai saat dev, jangan sampai kebawa ke prod.
      allowedOrigins: isDev ? ngrokOrigins : undefined,
    },
  },
};

export default nextConfig;
