import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the common loopback URL used by Firebase Emulator development.
  allowedDevOrigins: ['127.0.0.1'],

  // Firebase Admin currently reaches jwks-rsa -> jose. Bundling these server
  // packages keeps the ESM jose dependency compatible with Vercel's Node
  // serverless runtime instead of leaving a CommonJS require() at runtime.
  transpilePackages: ['firebase-admin', 'jwks-rsa', 'jose'],
};

export default nextConfig;
