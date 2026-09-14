import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, supabaseConfig } from "./lib/supabase/config";
export async function proxy(request: NextRequest) {
  if (!isConfigured()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/", "/api/:path*", "/auth/:path*"] };
