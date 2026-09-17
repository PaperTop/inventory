import { browserClient } from "./supabase/client";
import { PHOTO_BUCKET, PHOTO_EXTENSIONS, validatePhotoFile } from "./photos";

export async function uploadInventoryPhoto(file: File, userId: string) {
  validatePhotoFile(file);
  const client = browserClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user || user.id !== userId)
    throw new Error("Please sign in again to save photos to this account.");
  const path = `${user.id}/${crypto.randomUUID()}.${PHOTO_EXTENSIONS[file.type]}`;
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "0",
    upsert: false,
  });
  if (error)
    throw new Error(
      "Could not upload this photo. Check your connection and that photo storage is configured, then try again.",
    );
  return path;
}
