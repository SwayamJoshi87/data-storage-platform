import { S3Client, StorageClass } from '@aws-sdk/client-s3'
import { S3StandardBackend } from './S3StandardBackend'
import { S3GlacierBackend } from './S3GlacierBackend'
import type { StorageBackend } from './StorageBackend'

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const bucket = process.env.S3_BUCKET!

export function getBackend(tier: 'hot' | 'warm' | 'cold' | 'frozen'): StorageBackend {
  switch (tier) {
    case 'hot':
    case 'warm':
      return new S3StandardBackend(s3, bucket)
    case 'cold':
      return new S3GlacierBackend(s3, bucket, StorageClass.GLACIER)
    case 'frozen':
      return new S3GlacierBackend(s3, bucket, StorageClass.DEEP_ARCHIVE)
  }
}

export { S3StandardBackend } from './S3StandardBackend'
export { S3GlacierBackend } from './S3GlacierBackend'
export type { StorageBackend } from './StorageBackend'
