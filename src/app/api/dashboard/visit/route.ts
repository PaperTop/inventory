import { requestContext } from "@/lib/context";
import { handleDashboardVisit } from "@/lib/handlers";
import { safely } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return safely(async () =>
    handleDashboardVisit(request, await requestContext()),
  );
}
