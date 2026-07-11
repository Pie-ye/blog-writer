export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
export const PROCESSING_THRESHOLD_BYTES = 10 * 1024 * 1024;

export type SupportedMedia = {
  extension: "png" | "jpg" | "webp" | "gif" | "mp4";
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "video/mp4";
  kind: "image" | "video";
};

const SUPPORTED_TYPES: Record<string, SupportedMedia> = {
  "image/png": { extension: "png", mimeType: "image/png", kind: "image" },
  "image/jpeg": { extension: "jpg", mimeType: "image/jpeg", kind: "image" },
  "image/webp": { extension: "webp", mimeType: "image/webp", kind: "image" },
  "image/gif": { extension: "gif", mimeType: "image/gif", kind: "image" },
  "video/mp4": { extension: "mp4", mimeType: "video/mp4", kind: "video" },
};

export function supportedMediaForMime(mimeType: string): SupportedMedia | undefined {
  return SUPPORTED_TYPES[mimeType.toLowerCase()];
}

export function assertMediaUpload(file: Pick<File, "size" | "type">): SupportedMedia {
  if (file.size <= 0) throw new Error("The selected media file is empty.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Media files cannot exceed 100 MB.");

  const media = supportedMediaForMime(file.type);
  if (!media) throw new Error("Only PNG, JPEG, WebP, GIF, and MP4 files are supported.");

  return media;
}

export function requiresProcessing(size: number): boolean {
  return size > PROCESSING_THRESHOLD_BYTES;
}

export function detectMedia(bytes: Uint8Array): SupportedMedia | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return SUPPORTED_TYPES["image/png"];
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return SUPPORTED_TYPES["image/jpeg"];
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)))) return SUPPORTED_TYPES["image/gif"];
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return SUPPORTED_TYPES["image/webp"];
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") return SUPPORTED_TYPES["video/mp4"];
  return undefined;
}

export function assertMediaPayload(bytes: Uint8Array): SupportedMedia {
  if (bytes.length === 0) throw new Error("The uploaded media file is empty.");
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error("Media files cannot exceed 100 MB.");
  const media = detectMedia(bytes);
  if (!media) throw new Error("The uploaded bytes are not a supported PNG, JPEG, WebP, GIF, or MP4 file.");
  return media;
}
