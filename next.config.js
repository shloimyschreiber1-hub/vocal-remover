const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Files are uploaded directly to Supabase Storage from the browser, so the
  // server never receives large request bodies.
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
