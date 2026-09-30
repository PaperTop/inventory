import { z } from "zod";
import {
  askInventory,
  inventoryFactInput,
  questionInput,
  type AnswerProvider,
} from "./ask";
import { searchFacts } from "./inventory-search";
import { itemInput, itemUpdate } from "./inventory";
import type { ActivityActor } from "./dashboard";
import {
  authorize,
  HttpError,
  isSameOrigin,
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
      return json({
        items: await repository.list(q),
        limit: q.trim() ? 200 : null,
      });
    }
    if (request.method === "POST")
      return json(
        {
          item: await repository.create(
            itemInput.parse(await readBody(request)),
            mutationActor(request),
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
      return json({
        item: await repository.update(
          id,
          version,
          input,
          mutationActor(request),
        ),
      });
    }
    if (request.method === "DELETE") {
      const { version } = z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(await readBody(request));
      await repository.remove(id, version, mutationActor(request));
      return json({ deleted: true });
    }
    throw new HttpError(405, "Method not allowed.");
  });
}

function mutationActor(request: Request): ActivityActor {
  const actor = request.headers.get("x-inventory-actor");
  if (actor === null || actor === "user") return "user";
  if (actor === "jarvis") return "jarvis";
  throw new HttpError(400, "Invalid inventory activity actor.");
}

export function handleDashboard(
  request: Request,
  context: RequestContext | null,
) {
  return safely(async () => {
    const authorized = authorize(request, context);
    if (request.method !== "GET")
      throw new HttpError(405, "Method not allowed.");
    if (!authorized.dashboard)
      throw new HttpError(503, "Dashboard activity is unavailable.");
    return json(await authorized.dashboard.briefing());
  });
}

export function handleDashboardVisit(
  request: Request,
  context: RequestContext | null,
) {
  return safely(async () => {
    const authorized = authorize(request, context);
    if (request.method !== "POST")
      throw new HttpError(405, "Method not allowed.");
    if (!authorized.dashboard)
      throw new HttpError(503, "Dashboard activity is unavailable.");
    const { asOf } = z
      .object({ asOf: z.iso.datetime() })
      .strict()
      .parse(await readBody(request));
    await authorized.dashboard.acknowledge(asOf);
    return json({ acknowledged: true });
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
    if (request.method === "PATCH") {
      const { id, name } = z
        .object({ id: z.uuid(), name: z.string().trim().min(1).max(100) })
        .strict()
        .parse(await readBody(request));
      return json({ location: await repository.updateLocation(id, name) });
    }
    if (request.method === "DELETE") {
      const { id, destinationId } = z
        .object({ id: z.uuid(), destinationId: z.uuid().nullable() })
        .strict()
        .parse(await readBody(request));
      if (id === destinationId)
        throw new HttpError(400, "Choose a different destination space.");
      await repository.removeLocation(id, destinationId);
      return json({ deleted: true });
    }
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
    const { question, history } = questionInput.parse(
      await readBody(request, 128_000),
    );
    return json(
      await askInventory(
        question,
        { search: (q) => repository.list(q) },
        provider,
        history,
      ),
    );
  });
}

// Local snapshots have no account identity. Keep this model-backed demo off
// production; /api/ask continues to require an authenticated repository.
export function handleLocalAsk(request: Request, provider?: AnswerProvider) {
  return safely(async () => {
    if (process.env.NODE_ENV === "production")
      throw new HttpError(
        404,
        "Local Jarvis is available in development only.",
      );
    if (!isSameOrigin(request))
      throw new HttpError(403, "This request must come from the same site.");
    const { question, history, items } = questionInput
      .extend({
        items: z
          .array(inventoryFactInput)
          .max(200)
          .refine(
            (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
            "Inventory IDs must be unique",
          ),
      })
      .parse(await readBody(request, 256_000));
    return json(
      await askInventory(
        question,
        { search: async (query) => searchFacts(items, query) },
        provider,
        history,
      ),
    );
  });
}
