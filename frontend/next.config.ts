import type { NextConfig } from "next";

// Server-only env var — never exposed to the browser.
// Set BACKEND_URL in Vercel project settings (no NEXT_PUBLIC_ prefix).
// Fallback to the EB URL so it works without any config change.
const BACKEND_URL =
  process.env.BACKEND_URL ||
  "http://craftastudio-env.eba-brn8pyru.us-east-1.elasticbeanstalk.com";

const nextConfig: NextConfig = {
  async rewrites() {
    // In local dev, NEXT_PUBLIC_API_URL is set (e.g. http://localhost:3004)
    // so the client hits the backend directly — no rewrite needed.
    // On Vercel, NEXT_PUBLIC_API_URL must NOT be set; all /api/* calls are
    // relative and Vercel's server-side proxy forwards them to BACKEND_URL.
    if (process.env.NEXT_PUBLIC_API_URL) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
