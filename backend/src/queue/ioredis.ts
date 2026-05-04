import { Redis } from 'ioredis'
import { env } from '../config/env.js'

export function createRedisConnection() {
  const url = env.REDIS_URL?.trim()
  if (!url) {
    throw new Error('REDIS_URL is not configured.')
  }
  return new Redis(url, { maxRetriesPerRequest: null })
}
