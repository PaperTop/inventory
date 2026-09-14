import { z } from "zod";
import { askInventory, questionInput, type AnswerProvider } from "./ask";
import { itemInput, itemUpdate } from "./inventory";
import {
  authorize,
  HttpError,
  json,
  readBody,
  safely,
  type RequestContext,
} from "./http";
export function handleItems(request: Request, context: RequestContext | null) {
  return safely(async () => {
    const { repository } = authorize(request, context);
    if (request.method === "GET") {
      const q = z
        .string()
        .max(200)
        .parse(new URL(request.url).searchParams.get("q") ?? "");
      return json({ items: await repository.list(q), limit: 200 });
    }
    if (request.method === "POST")
      return json(
        {
          item: await repository.create(
            itemInput.parse(await readBody(request)),
          ),
        },
        201,
      );
    throw new HttpError(405, "Method not allowed.");
  });
}
export function handleItem(
  request: Request,
  id: string,
  context: RequestContext | null,
) {
  return safely(async () => {
    const { repository } = authorize(request, context);
    z.uuid().parse(id);
    if (request.method === "PUT") {
      const { version, ...input } = itemUpdate.parse(await readBody(request));
      return json({ item: await repository.update(id, version, input) });
    }
    if (request.method === "DELETE") {
      const { version } = z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(await readBody(request));
      await repository.remove(id, version);
      return json({ deleted: true });
    }
    throw new HttpError(405, "Method not allowed.");
  });
}
export function handleLocations(
  request: Request,
  context: RequestContext | null,
) {
  return safely(async () => {
    const { repository } = authorize(request, context);
    if (request.method === "GET")
      return json({ locations: await repository.locations() });
    if (request.method === "POST") {
      const { name } = z
        .object({ name: z.string().trim().min(1).max(100) })
        .strict()
        .parse(await readBody(request));
      return json({ location: await repository.createLocation(name) }, 201);
    }
    throw new HttpError(405, "Method not allowed.");
  });
}
export function handleAsk(
  request: Request,
  context: RequestContext | null,
  provider?: AnswerProvider,
) {
  return safely(async () => {
    const { repository } = authorize(request, context);
    const { question } = questionInput.parse(await readBody(request));
    return json(
      await askInventory(
        question,
        { search: (q) => repository.list(q) },
        provider,
      ),
    );
  });
}
