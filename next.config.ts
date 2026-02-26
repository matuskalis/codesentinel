import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['bullmq', 'ioredis', 'pino', 'pino-pretty'],
}

export default nextConfig
