import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
  StorageClass,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  StorageBackend, PutOptions, PutResult, RetrievalJob,
  RetrievalStatus, ObjectMetadata, Urgency,
} from './StorageBackend'

const RESTORE_TIERS: Record<Urgency, string> = {
  bulk:      'Bulk',
  standard:  'Standard',
  expedited: 'Expedited',
}

// Estimated restore completion times (rough) in milliseconds
const RESTORE_DURATION_MS: Record<Urgency, number> = {
  bulk:      48 * 60 * 60 * 1000,
  standard:  12 * 60 * 60 * 1000,
  expedited:  4 * 60 * 60 * 1000,
}

export class S3GlacierBackend implements StorageBackend {
  constructor(
    private s3: S3Client,
    private bucket: string,
    // GLACIER = Glacier Instant Retrieval (cold), DEEP_ARCHIVE = Glacier Deep Archive (frozen)
    private storageClass: StorageClass.GLACIER | StorageClass.DEEP_ARCHIVE,
  ) {}

  async put(key: string, body: Buffer | Uint8Array, opts: PutOptions): Promise<PutResult> {
    const res = await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: opts.contentType,
      ContentLength: opts.sizeBytes,
      StorageClass: this.storageClass,
      Metadata: opts.metadata,
    }))
    return { etag: res.ETag ?? '' }
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        StorageClass: this.storageClass,
      }),
      { expiresIn: expiresInSeconds },
    )
  }

  async initiateRetrieval(key: string, urgency: Urgency): Promise<RetrievalJob> {
    await this.s3.send(new RestoreObjectCommand({
      Bucket: this.bucket,
      Key: key,
      RestoreRequest: {
        Days: 3,
        GlacierJobParameters: { Tier: RESTORE_TIERS[urgency] },
      },
    }))
    return {
      jobId: `restore-${key}`,
      estimatedCompletionAt: new Date(Date.now() + RESTORE_DURATION_MS[urgency]),
    }
  }

  async pollRetrieval(key: string): Promise<RetrievalStatus> {
    const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
    // The Restore header is present and contains 'ongoing-request="false"' when restore is done
    const restore = res.Restore ?? ''
    return restore.includes('ongoing-request="false"') ? 'ready' : 'pending'
  }

  async getPresignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    )
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async headObject(key: string): Promise<ObjectMetadata> {
    const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
    return {
      sizeBytes: res.ContentLength ?? 0,
      lastModified: res.LastModified ?? new Date(),
      storageClass: res.StorageClass ?? String(this.storageClass),
      etag: res.ETag ?? '',
    }
  }
}
