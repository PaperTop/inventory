import { handleItems } from "@/lib/handlers";
import { requestContext } from "@/lib/context";
import { safely } from "@/lib/http";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return safely(async () => handleItems(request, await requestContext()));
}
export function POST(request: Request) {
  return safely(async () => handleItems(request, await requestContext()));
}
