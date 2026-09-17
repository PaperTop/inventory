import { handleLocalAsk } from "@/lib/handlers";
import { configuredProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export function POST(request: Request) {
  return handleLocalAsk(request, configuredProvider());
}
