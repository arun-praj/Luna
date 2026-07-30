import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones on the local network to load the development client and HMR.
  allowedDevOrigins: ["192.168.1.160"],
};

export default nextConfig;
