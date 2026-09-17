import type { InventoryRepository } from "./contracts";
import type { AskResult, ChatTurn, InventoryFact } from "./ask";
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
export const apiRepository: InventoryRepository = {
  list: async (q) =>
    (await request(`/api/items?q=${encodeURIComponent(q)}`)).items,
  create: async (input) => (await request("/api/items", "POST", input)).item,
  update: async (id, version, input) =>
    (await request(`/api/items/${id}`, "PUT", { ...input, version })).item,
  remove: async (id, version) => {
    await request(`/api/items/${id}`, "DELETE", { version });
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
