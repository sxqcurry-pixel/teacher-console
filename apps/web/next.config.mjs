/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@spark/shared'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-*'],
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    // Server-side proxy: browser hits same-origin /api/v1/*, Vercel forwards to Railway.
    // BACKEND_URL is a SERVER-ONLY env var (no NEXT_PUBLIC_ prefix) → no CORS, not exposed to browser.
    const backend =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001/api/v1';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
