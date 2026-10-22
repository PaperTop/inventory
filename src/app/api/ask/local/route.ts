import { handleLocalAsk } from "@/lib/handlers";
import { configuredProvider, jarvisAvailability } from "@/lib/provider";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Public capability metadata only, never credentials, model inputs or an AI call.
export function GET() {
  return json({
    mode: jarvisAvailability().demo ? "ai" : "search",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}

export function POST(request: Request) {
  return handleLocalAsk(request, configuredProvider());
}
