export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT) || 4000,
  WEB_APP_ORIGIN: process.env.WEB_APP_ORIGIN ?? 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/trailread',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-change-me',
}
