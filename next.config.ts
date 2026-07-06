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
  // Izinkan akses dev server via tunnel ngrok (HMR/asset dev-only).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io", "*.ngrok.app"],
  experimental: {
    serverActions: {
      // Izinkan Server Action (mis. Tambah Pegawai) dipanggil dari origin ngrok.
      allowedOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io", "*.ngrok.app"],
    },
  },
};

export default nextConfig;
