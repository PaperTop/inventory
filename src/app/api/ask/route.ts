import { handleAsk } from "@/lib/handlers";
import { requestContext } from "@/lib/context";
import { safely } from "@/lib/http";
import { configuredProvider } from "@/lib/provider";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export function POST(request: Request) {
  return safely(async () =>
    handleAsk(request, await requestContext(), configuredProvider()),
  );
}
