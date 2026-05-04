import { createRedisConnection } from '../queue/ioredis.js'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'

const LIMIT = 30
const WINDOW_SEC = 3600

let redisSingleton: ReturnType<typeof createRedisConnection> | null = null

function getRedis() {
  const url = env.REDIS_URL?.trim()
  if (!url) return null
  if (!redisSingleton) {
    redisSingleton = createRedisConnection()
  }
  return redisSingleton
}

function hourBucket(): string {
  return String(Math.floor(Date.now() / (WINDOW_SEC * 1000)))
}

export async function assertHighlightRateLimit(userId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    if (env.NODE_ENV === 'production') {
      throw new AppError('INTERNAL_ERROR', 500, 'Rate limiting unavailable', {})
    }
    return
  }

  const key = `rl:highlight:${userId}:${hourBucket()}`
  const n = await redis.incr(key)
  if (n === 1) {
    await redis.expire(key, WINDOW_SEC)
  }
  if (n > LIMIT) {
    throw new AppError('RATE_LIMITED', 429, 'Too many highlight requests. Try again later.', {})
  }
}
