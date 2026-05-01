export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'heic', 'heif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus']);
const ARCHIVE_EXTS = new Set(['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz']);
const TEXT_EXTS = new Set(['txt', 'md', 'json', 'csv', 'xml', 'yaml', 'yml', 'log', 'ts', 'tsx', 'js', 'jsx']);

export function getFileCategory(name: string): FileCategory {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (TEXT_EXTS.has(ext)) return 'text';
  if (ARCHIVE_EXTS.has(ext)) return 'archive';
  return 'other';
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(date?: Date): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(date?: Date): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getFileExtension(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

export function categoryColor(cat: FileCategory): string {
  switch (cat) {
    case 'image': return 'text-emerald-400';
    case 'video': return 'text-purple-400';
    case 'audio': return 'text-pink-400';
    case 'pdf': return 'text-red-400';
    case 'text': return 'text-blue-400';
    case 'archive': return 'text-amber-400';
    default: return 'text-muted-foreground';
  }
}
