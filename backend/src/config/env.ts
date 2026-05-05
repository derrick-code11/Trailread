function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT) || 4000,
  WEB_APP_ORIGIN: process.env.WEB_APP_ORIGIN ?? 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-change-me',
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? 'trailread_session',
  SESSION_DURATION_DAYS: Number(process.env.SESSION_DURATION_DAYS) || 30,

  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  EMAIL_FROM: process.env.EMAIL_FROM ?? '',

  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? '',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4.1-mini',
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE ?? 'alloy',

  S3_ENDPOINT: process.env.S3_ENDPOINT ?? '',
  S3_REGION: process.env.S3_REGION ?? 'auto',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? '',
  S3_BUCKET: process.env.S3_BUCKET ?? '',
  S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL ?? '',
}

export function assertProductionSecrets(): void {
  if (env.NODE_ENV !== 'production') return
  required('SESSION_SECRET', process.env.SESSION_SECRET)
}
