export type Urgency = 'bulk' | 'standard' | 'expedited'

export interface PutOptions {
  contentType: string
  sizeBytes: number
  metadata?: Record<string, string>
}

export interface PutResult {
  etag: string
}

export interface RetrievalJob {
  jobId: string
  estimatedCompletionAt: Date
}

export type RetrievalStatus = 'pending' | 'ready'

export interface ObjectMetadata {
  sizeBytes: number
  lastModified: Date
  storageClass: string
  etag: string
}

export interface StorageBackend {
  /** Upload an object. Used for small server-side uploads; large files use presigned URLs. */
  put(key: string, body: Buffer | Uint8Array, opts: PutOptions): Promise<PutResult>

  /** Generate a presigned URL for direct client-to-S3 multipart upload. */
  getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>

  /** Initiate a Glacier restore job (no-op for hot/warm tiers). */
  initiateRetrieval(key: string, urgency: Urgency): Promise<RetrievalJob>

  /** Check whether a Glacier restore has completed. */
  pollRetrieval(key: string): Promise<RetrievalStatus>

  /** Generate a presigned URL for client download. */
  getPresignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>

  delete(key: string): Promise<void>
  headObject(key: string): Promise<ObjectMetadata>
}
