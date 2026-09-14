import { handleItem } from "@/lib/handlers";
import { requestContext } from "@/lib/context";
import { safely } from "@/lib/http";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export function PUT(request: Request, { params }: Params) {
  return safely(async () =>
    handleItem(request, (await params).id, await requestContext()),
  );
}
export function DELETE(request: Request, { params }: Params) {
  return safely(async () =>
    handleItem(request, (await params).id, await requestContext()),
  );
}
