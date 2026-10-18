import type { InventoryRepository } from "./contracts";
import type { AskResult, ChatTurn, InventoryFact } from "./ask";
import type { ActivityActor, DashboardBriefing } from "./dashboard";
import type { InventoryScope, InventoryResult } from "./inventory-scope";
import type { Location } from "./inventory";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  extraHeaders?: Record<string, string>,
) {
  const response = await fetch(path, {
    method,
    headers: body
      ? { "content-type": "application/json", ...extraHeaders }
      : extraHeaders,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(response.status, data.error || "Request failed.");
  return data;
}
const actorHeader = (actor?: ActivityActor) =>
  actor ? { "X-Inventory-Actor": actor } : undefined;
export const apiRepository: InventoryRepository = {
  list: async (q) =>
    (await request(`/api/items?q=${encodeURIComponent(q)}`)).items,
  create: async (input, actor, requestId) =>
    (
      await request("/api/items", "POST", input, {
        ...actorHeader(actor),
        ...(requestId ? { "X-Inventory-Request-Id": requestId } : {}),
      })
    ).item,
  update: async (id, version, input, actor) =>
    (
      await request(
        `/api/items/${id}`,
        "PUT",
        { ...input, version },
        actorHeader(actor),
      )
    ).item,
  remove: async (id, version, actor) => {
    await request(
      `/api/items/${id}`,
      "DELETE",
      { version },
      actorHeader(actor),
    );
  },
  locations: async () => (await request("/api/locations")).locations,
  createLocation: async (name, parent_location_id, requestId) =>
    (
      await request(
        "/api/locations",
        "POST",
        {
          name,
          ...(parent_location_id !== undefined ? { parent_location_id } : {}),
        },
        requestId ? { "X-Inventory-Request-Id": requestId } : undefined,
      )
    ).location,
  updateLocation: async (id, name) =>
    (await request("/api/locations", "PATCH", { id, name })).location,
  removeLocation: async (id, destinationId) => {
    await request("/api/locations", "DELETE", { id, destinationId });
  },
};
export const contentsApi = (
  scope: InventoryScope,
  offset = 0,
  revision?: string,
): Promise<InventoryResult> => {
  const params = new URLSearchParams({
    type: scope.type,
    offset: String(offset),
  });
  if (scope.id) params.set("id", scope.id);
  if (revision) params.set("revision", revision);
  return request(`/api/inventory/contents?${params}`);
};
export const askApi = (
  question: string,
  history?: ChatTurn[],
): Promise<AskResult> => request("/api/ask", "POST", { question, history });
export const askLocalApi = (
  question: string,
  items: InventoryFact[],
  history?: ChatTurn[],
  locations?: Location[],
): Promise<AskResult> =>
  request("/api/ask/local", "POST", { question, items, history, locations });
export const dashboardApi = (): Promise<DashboardBriefing> =>
  request("/api/dashboard");
export const markDashboardVisited = (asOf: string): Promise<void> =>
  request("/api/dashboard/visit", "POST", { asOf }).then(() => undefined);
