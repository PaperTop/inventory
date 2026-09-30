import { requestContext } from "@/lib/context";
import { handleDashboard } from "@/lib/handlers";
import { safely } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return safely(async () => handleDashboard(request, await requestContext()));
}
