import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  StorageBackend, PutOptions, PutResult, RetrievalJob,
  RetrievalStatus, ObjectMetadata, Urgency,
} from './StorageBackend'

export class S3StandardBackend implements StorageBackend {
  constructor(private s3: S3Client, private bucket: string) {}

  async put(key: string, body: Buffer | Uint8Array, opts: PutOptions): Promise<PutResult> {
    const res = await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: opts.contentType,
      ContentLength: opts.sizeBytes,
      Metadata: opts.metadata,
    }))
    return { etag: res.ETag ?? '' }
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    )
  }

  // Hot / warm objects are always accessible — retrieval is a no-op
  async initiateRetrieval(_key: string, _urgency: Urgency): Promise<RetrievalJob> {
    return { jobId: 'direct', estimatedCompletionAt: new Date() }
  }

  async pollRetrieval(_key: string): Promise<RetrievalStatus> {
    return 'ready'
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
      storageClass: res.StorageClass ?? 'STANDARD',
      etag: res.ETag ?? '',
    }
  }
}
