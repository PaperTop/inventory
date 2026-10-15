import { requestContext } from "@/lib/context";
import { handleInventoryContents } from "@/lib/handlers";
import { safely } from "@/lib/http";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return safely(async () =>
    handleInventoryContents(request, await requestContext()),
  );
}
