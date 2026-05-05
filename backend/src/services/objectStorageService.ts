import { createHash } from 'crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'

let s3ClientSingleton: S3Client | null = null

function requireStorageConfig() {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
    throw new AppError('INTERNAL_ERROR', 500, 'Object storage is not configured', {})
  }

  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
  }
}

function getS3Client(): S3Client {
  const cfg = requireStorageConfig()
  if (!s3ClientSingleton) {
    s3ClientSingleton = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: true,
    })
  }
  return s3ClientSingleton
}

export function buildPodcastStorageKey(bookId: string, chapterId: string): string {
  const digest = createHash('sha1').update(`${bookId}:${chapterId}:recap-v1`).digest('hex').slice(0, 10)
  return `podcasts/${bookId}/${chapterId}/recap-${digest}.mp3`
}

export async function uploadAudioObject(storageKey: string, body: Buffer): Promise<void> {
  const { bucket } = requireStorageConfig()
  const client = getS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: body,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
}

export async function createSignedPlaybackUrl(storageKey: string, expiresInSeconds = 60 * 15): Promise<string> {
  const { bucket } = requireStorageConfig()
  const client = getS3Client()
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ResponseContentType: 'audio/mpeg',
    }),
    { expiresIn: expiresInSeconds },
  )
}

export function getStoragePublicUrl(storageKey: string): string | null {
  const { publicBaseUrl } = requireStorageConfig()
  if (!publicBaseUrl) return null
  return `${publicBaseUrl.replace(/\/+$/, '')}/${storageKey}`
}
