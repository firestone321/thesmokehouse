/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "@supabase/ssr"]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "stvbivbatrlutqhgfgic.supabase.co" }
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
