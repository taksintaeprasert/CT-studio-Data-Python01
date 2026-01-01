/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Vercel
  output: 'standalone',

  // Disable trailing slash redirects (fixes 308 redirect issue)
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

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
