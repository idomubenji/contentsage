/** @type {import('next').NextConfig} */
// Updated Next.js configuration bruh
const nextConfig = {
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
  // Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Remove these unsupported options
  // optimizeFonts: true,
  // swcMinify: true,
  poweredByHeader: false,
  output: "standalone",
  experimental: {
    optimizeCss: process.env.NODE_ENV === 'production',
  },
  // Make sure asset prefix is correctly set
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Powered-By',
            value: 'ContentSage',
          },
        ],
      },
    ];
  },
};

export default nextConfig; 