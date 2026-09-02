/** @type {import('next').NextConfig} */
const apiOrigin = process.env.API_ORIGIN || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mosaic/contracts"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
