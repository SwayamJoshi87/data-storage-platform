import { getFileCategory } from '@/lib/fileUtils';

export function getThumbnailPath(filePath: string) {
  return `thumbnails/${filePath}.jpg`;
}

export function shouldGenerateThumbnail(file: File) {
  return getFileCategory(file.name) === 'video';
}

export async function createVideoThumbnail(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement('video');
    video.src = sourceUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Unable to load video metadata'));
    });

    video.currentTime = Math.min(0.25, Math.max(0, video.duration / 10));

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Unable to capture video thumbnail'));
    });

    const canvas = document.createElement('canvas');
    const ratio = video.videoWidth / video.videoHeight || 16 / 9;
    canvas.width = 640;
    canvas.height = Math.round(canvas.width / ratio);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare video thumbnail');

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((thumbnailBlob) => {
        if (thumbnailBlob) resolve(thumbnailBlob);
        else reject(new Error('Unable to encode video thumbnail'));
      }, 'image/jpeg', 0.82);
    });

    return new File([blob], `${file.name}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
