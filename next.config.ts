import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Allow local-network devices and development tunnel hosts to load the
  // development client and HMR. Keep these allowances development-only in
  // practice: Next.js applies allowedDevOrigins only to the dev server.
  allowedDevOrigins: [
    "192.168.1.160",
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
