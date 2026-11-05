import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";

// Security headers on every page: no framing (clickjacking), no MIME sniffing,
// HTTPS only, minimal referrer, and a content security policy in production.
const security = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), autoplay=(self \"https://open.spotify.com\"), encrypted-media=(self \"https://open.spotify.com\")" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(prod
    ? [
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // the Spotify iFrame API uses eval internally; without it the player never appears
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://open.spotify.com https://*.spotifycdn.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.scdn.co https://*.spotifycdn.com",
            "font-src 'self' data:",
            "connect-src 'self' https://*.spotify.com https://*.spotifycdn.com",
            "worker-src 'self'",
            "media-src 'self' blob:",
            "frame-src https://www.openstreetmap.org https://open.spotify.com",
            "manifest-src 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self' https://accounts.google.com",
          ].join("; "),
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Danchi is a private, fully personalised app: every page depends on the
  // signed in session, so we render on request and skip Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: security },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Going back to a page you just saw is instant; live updates keep it fresh.
    staleTimes: { dynamic: 30, static: 180 },
    optimizePackageImports: ["@google/genai"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
