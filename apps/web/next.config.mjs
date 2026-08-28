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
  // API 代理统一由 src/app/api/v1/[...path]/route.ts 处理（本地 dev 与线上一致），
  // 不再使用 next.config rewrites（其在 Netlify 上的外部代理会丢失 Host/请求体）。
};

export default nextConfig;
