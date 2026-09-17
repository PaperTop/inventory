export const PHOTO_BUCKET = "inventory-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validatePhotoFile(file: { type: string; size: number }) {
  if (!Object.hasOwn(PHOTO_EXTENSIONS, file.type))
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES)
    throw new Error("Choose a nonempty image that is 5 MB or smaller.");
}

const storedPath =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function privatePhotoPath(
  value: unknown,
  userId: string,
): string | null {
  return typeof value === "string" &&
    storedPath.test(value) &&
    value.startsWith(`${userId}/`)
    ? value
    : null;
}

export function privatePhotoSource(id: string, path: string) {
  // The query changes only with the photo, so ordinary item edits don't reload it.
  // The reader always resolves the current DB reference, never this query value.
  return `/api/items/${encodeURIComponent(id)}/photo?image=${encodeURIComponent(path)}`;
}
