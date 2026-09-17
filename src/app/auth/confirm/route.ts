import { serverClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/supabase/config";
export async function GET(request: Request) {
  const url = new URL(request.url),
    token_hash = url.searchParams.get("token_hash");
  let destination = "/?authError=confirmation";
  if (!isConfigured()) destination = "/?authError=setup";
  else if (token_hash && url.searchParams.get("type") === "email") {
    try {
      const client = await serverClient();
      const { error } = await client.auth.verifyOtp({
        type: "email",
        token_hash,
      });
      if (!error) destination = "/?auth=confirmed";
    } catch {
      destination = "/?authError=unavailable";
    }
  }
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
