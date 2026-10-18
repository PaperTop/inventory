import { z } from "zod";
import {
  askInventory,
  inventoryFactInput,
  questionInput,
  type AnswerProvider,
} from "./ask";
import { searchFacts } from "./inventory-search";
import {
  itemInput,
  itemUpdate,
  searchInventory,
  type Item,
  type Location,
} from "./inventory";
import { resolveHierarchy } from "./containers";
import { acquireDemoUsage } from "./demo-ai-limits";
import type { ActivityActor } from "./dashboard";
import { inventoryContents, InventoryScopeChanged } from "./inventory-scope";
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
            creationRequestId(request),
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

function creationRequestId(request: Request) {
  const key = request.headers.get("x-inventory-request-id");
  return key === null ? undefined : z.uuid().parse(key);
}

export function handleInventoryContents(
  request: Request,
  context: RequestContext | null,
) {
  return safely(async () => {
    const { repository } = authorize(request, context);
    if (request.method !== "GET")
      throw new HttpError(405, "Method not allowed.");
    const params = new URL(request.url).searchParams;
    const type = z
      .enum(["location", "container", "all"])
      .parse(params.get("type"));
    const id = type === "all" ? undefined : z.uuid().parse(params.get("id"));
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(1_000_000_000)
      .parse(params.get("offset") ?? 0);
    const revision = params.has("revision")
      ? z
          .string()
          .regex(/^[0-9a-f]{16}$/)
          .parse(params.get("revision"))
      : undefined;
    const [items, locations] = await Promise.all([
      repository.list(""),
      repository.locations(),
    ]);
    try {
      return json(
        inventoryContents(items, locations, { type, id }, offset, revision),
      );
    } catch (error) {
      if (error instanceof InventoryScopeChanged)
        throw new HttpError(409, error.message);
      throw new HttpError(
        404,
        error instanceof Error ? error.message : "Scope unavailable.",
      );
    }
  });
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
      const { name, parent_location_id } = z
        .object({
          name: z.string().trim().min(1).max(100),
          parent_location_id: z.uuid().nullable().optional(),
        })
        .strict()
        .parse(await readBody(request));
      return json(
        {
          location: await repository.createLocation(
            name,
            parent_location_id,
            creationRequestId(request),
          ),
        },
        201,
      );
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
    let snapshot: Promise<{ items: Item[]; locations: Location[] }> | undefined;
    const getSnapshot = () =>
      (snapshot ??= Promise.all([
        repository.list(""),
        repository.locations(),
      ]).then(([items, locations]) => ({ items, locations })));
    return json(
      await askInventory(
        question,
        {
          snapshot: getSnapshot,
          search: async (q) => searchInventory((await getSnapshot()).items, q),
        },
        provider,
        history,
      ),
    );
  });
}

// Demo snapshots are session-only. This endpoint never receives a database
// repository; saved inventory continues to require /api/ask authentication.
export function handleLocalAsk(request: Request, provider?: AnswerProvider) {
  return safely(async () => {
    if (request.method !== "POST")
      throw new HttpError(405, "Method not allowed.");
    if (!isSameOrigin(request))
      throw new HttpError(403, "This request must come from the same site.");
    const production = process.env.NODE_ENV === "production";
    if (production && process.env.DEMO_AI_ENABLED === "false")
      throw new HttpError(503, "Demo AI has been disabled by the site owner.");
    if (production && !provider)
      throw new HttpError(
        503,
        "Configure the server AI provider, model and API key to enable demo AI.",
      );
    const { question, history, items, locations } = questionInput
      .extend({
        items: z
          .array(inventoryFactInput)
          .max(production ? 200 : 5000)
          .refine(
            (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
            "Inventory IDs must be unique",
          ),
        locations: z
          .array(
            z
              .object({
                id: z.string().min(1).max(160),
                user_id: z.string().max(160).default("local"),
                name: z.string().min(1).max(100),
                parent_location_id: z.string().max(160).nullable().optional(),
                version: z.number().int().positive().optional(),
              })
              .strict(),
          )
          .max(production ? 100 : 1000)
          .default([]),
      })
      .parse(await readBody(request, production ? 128_000 : 8_000_000));
    const localItems: Item[] = items.map((item) => ({
      ...item,
      kind: item.kind ?? (item.quantity === 1 ? "durable" : "consumable"),
      user_id: "local",
      location_id: item.parent_container_id
        ? null
        : (item.resolved_location_id ?? null),
      reorder_threshold: null,
      version: 1,
      created_at: "",
      updated_at: "",
    }));
    const localLocations = locations.map((location) => ({
      ...location,
      user_id: "local",
    }));
    const snapshot = {
      items: resolveHierarchy(localItems, localLocations),
      locations: localLocations,
    };
    const release = production ? acquireDemoUsage(request) : undefined;
    try {
      return json(
        await askInventory(
          question,
          {
            snapshot: async () => snapshot,
            search: async (query) => searchFacts(items, query),
          },
          provider,
          history,
        ),
      );
    } finally {
      release?.();
    }
  });
}
