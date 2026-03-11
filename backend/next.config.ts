import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Optimize for API-only usage
  output: 'standalone',
  
  // Disable features not needed for headless API
  images: {
    unoptimized: true,
  },
  
  // Allow large JSON imports (100MB max)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
  
  // Headers for API security and CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          // Security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // CORS headers - handled dynamically in middleware for multiple origins
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
        ],
      },
    ]
  },
}

export default nextConfig
