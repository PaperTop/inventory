import { serverClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url),
    token_hash = url.searchParams.get("token_hash");
  if (token_hash && url.searchParams.get("type") === "email") {
    const client = await serverClient();
    const { error } = await client.auth.verifyOtp({
      type: "email",
      token_hash,
    });
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/?authError=confirmation", url.origin));
}
