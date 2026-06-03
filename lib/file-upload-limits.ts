export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const PURCHASE_DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const LEGAL_ACT_ALLOWED_MIME_TYPES = [
  ...PURCHASE_DOCUMENT_ALLOWED_MIME_TYPES,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  const sizeInMb = bytes / 1024 / 1024;
  return Number.isInteger(sizeInMb)
    ? `${sizeInMb} MB`
    : `${sizeInMb.toFixed(1)} MB`;
}

export function getFileSizeLimitMessage(maxBytes: number) {
  return `Файлын зөвшөөрөх дээд хэмжээ: ${formatFileSize(maxBytes)}. Хэтэрсэн файл оруулах боломжгүй.`;
}

export function getFileTooLargeMessage(fileName: string, maxBytes: number) {
  return `${fileName} файлын хэмжээ ${formatFileSize(maxBytes)}-аас их байж болохгүй.`;
}
