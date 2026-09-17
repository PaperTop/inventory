import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "./http";
import { PHOTO_BUCKET, privatePhotoPath } from "./photos";

export function createPhotoReader(client: SupabaseClient, userId: string) {
  return async (id: string): Promise<string> => {
    const { data, error } = await client
      .from("items")
      .select("attributes")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw new HttpError(
        503,
        "Photo storage is unavailable. Please try again.",
      );
    const path = privatePhotoPath(data?.attributes?.image_path, userId);
    if (!path) throw new HttpError(404, "Photo not found.");
    const { data: signed, error: signError } = await client.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60);
    if (signError || !signed)
      throw new HttpError(
        503,
        "Photo storage is unavailable. Check that the photo storage migration has been applied.",
      );
    return signed.signedUrl;
  };
}

export async function handlePhoto(
  _request: Request,
  id: string,
  context: { userId: string; read: (id: string) => Promise<string> } | null,
) {
  if (!context) throw new HttpError(401, "Please sign in to view your photos.");
  z.uuid().parse(id);
  const url = await context.read(id);
  return new Response(null, {
    status: 307,
    headers: {
      Location: url,
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "Referrer-Policy": "no-referrer",
    },
  });
}
