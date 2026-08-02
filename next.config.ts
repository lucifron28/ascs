import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the common loopback URL used by Firebase Emulator development.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
