export type StorageTier = 'hot' | 'warm' | 'cold' | 'frozen';
export type RetrievalUrgency = 'bulk' | 'standard' | 'expedited';
export type RetrievalStatus = 'pending' | 'restoring' | 'ready' | 'failed';

export interface PutOpts {
  contentType: string;
  tier: StorageTier;
  sizeBytes: number;
}

export interface PutResult {
  s3Key: string;
  eTag?: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fields: Record<string, string>;
  s3Key: string;
}

export interface RetrievalJob {
  jobId: string;
  estimatedReadyAt: Date;
}

export interface ObjectMetadata {
  sizeBytes: number;
  contentType: string;
  lastModified: Date;
  storageClass: string;
}

// TODO Step 5: implement S3StandardBackend and S3GlacierDeepArchiveBackend
export interface StorageBackend {
  /** Generate a presigned URL for direct browser → S3 upload. */
  generatePresignedUploadUrl(s3Key: string, opts: PutOpts): Promise<PresignedUploadResult>;

  /** Initiate a Glacier restore request. */
  initiateRetrieval(s3Key: string, urgency: RetrievalUrgency): Promise<RetrievalJob>;

  /** Poll Glacier restore status. */
  pollRetrieval(s3Key: string): Promise<RetrievalStatus>;

  /** Generate a presigned download URL for a ready object. */
  getDownloadUrl(s3Key: string, ttlSeconds: number): Promise<string>;

  /** Permanently delete an object (and any thumbnails). */
  delete(s3Key: string): Promise<void>;

  /** HEAD request — size, content type, storage class. */
  headObject(s3Key: string): Promise<ObjectMetadata>;
}
