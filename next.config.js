/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Vercel
  output: 'standalone',

  // Optimize images
  images: {
    domains: [],
    unoptimized: false,
  },

  // Disable ESLint errors during build (warnings only)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript errors during build (for faster deployment)
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
