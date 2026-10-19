/** Media helpers: detect video URLs/mimes and pick upload extensions. */

const VIDEO_URL_RE = /\.(mp4|m4v|mov|webm|ogv)(?:[?#]|$)/i;

export function isVideoUrl(url?: string | null): boolean {
  return Boolean(url && VIDEO_URL_RE.test(url));
}

export function isVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("video/");
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function extensionForMime(mime: string): string {
  const clean = mime.split(";")[0].trim().toLowerCase();
  return EXT[clean] ?? (clean.startsWith("video/") ? "webm" : "jpg");
}
