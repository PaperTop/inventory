import { createPhotoReader, handlePhoto } from "@/lib/photo-reader";
import { HttpError, safely } from "@/lib/http";
import { isConfigured } from "@/lib/supabase/config";
import { serverClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safely(async () => {
    if (!isConfigured())
      throw new HttpError(
        503,
        "Connect Supabase to save and view private photos.",
      );
    const client = await serverClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    return handlePhoto(
      request,
      (await params).id,
      user && !error
        ? { userId: user.id, read: createPhotoReader(client, user.id) }
        : null,
    );
  });
}
