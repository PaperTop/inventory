import type { InventoryRepository } from "./contracts";
import type { AskResult, ChatTurn, InventoryFact } from "./ask";
import type { ActivityActor, DashboardBriefing } from "./dashboard";
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
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
const actorHeader = (actor?: ActivityActor) =>
  actor ? { "X-Inventory-Actor": actor } : undefined;
export const apiRepository: InventoryRepository = {
  list: async (q) =>
    (await request(`/api/items?q=${encodeURIComponent(q)}`)).items,
  create: async (input, actor) =>
    (await request("/api/items", "POST", input, actorHeader(actor))).item,
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
  createLocation: async (name) =>
    (await request("/api/locations", "POST", { name })).location,
  updateLocation: async (id, name) =>
    (await request("/api/locations", "PATCH", { id, name })).location,
  removeLocation: async (id, destinationId) => {
    await request("/api/locations", "DELETE", { id, destinationId });
  },
};
export const askApi = (
  question: string,
  history?: ChatTurn[],
): Promise<AskResult> => request("/api/ask", "POST", { question, history });
export const askLocalApi = (
  question: string,
  items: InventoryFact[],
  history?: ChatTurn[],
): Promise<AskResult> =>
  request("/api/ask/local", "POST", { question, items, history });
export const dashboardApi = (): Promise<DashboardBriefing> =>
  request("/api/dashboard");
export const markDashboardVisited = (asOf: string): Promise<void> =>
  request("/api/dashboard/visit", "POST", { asOf }).then(() => undefined);
