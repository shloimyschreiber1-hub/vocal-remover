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
}

module.exports = nextConfig
