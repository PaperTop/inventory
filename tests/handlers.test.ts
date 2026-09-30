import { expect, it } from "vitest";
import {
  handleItems,
  handleItem,
  handleAsk,
  handleDashboard,
  handleDashboardVisit,
  handleLocations,
} from "../src/lib/handlers";
import { itemInput, type Item } from "../src/lib/inventory";
import { HttpError, type RequestContext } from "../src/lib/http";
import type { InventoryRepository } from "../src/lib/contracts";
const id = "44444444-4444-4444-8444-444444444444";
function setup() {
  const rows = new Map<string, Item>();
  const actors: string[] = [];
  const repo: InventoryRepository = {
    list: async () => [...rows.values()],
    create: async (input, actor = "user") => {
      actors.push(actor);
      const item = {
        ...input,
        id,
        user_id: id,
        version: 1,
        created_at: "2026-09-13",
        updated_at: "2026-09-13",
        location_name: null,
      };
      rows.set(id, item);
      return item;
    },
    update: async (key, version, input, actor = "user") => {
      actors.push(actor);
      const item = rows.get(key);
      if (!item) throw new HttpError(404, "Not found");
      if (item.version !== version) throw new HttpError(409, "Conflict");
      const next = { ...item, ...input, version: version + 1 };
      rows.set(key, next);
      return next;
    },
    remove: async (key, version, actor = "user") => {
      actors.push(actor);
      const item = rows.get(key);
      if (!item) throw new HttpError(404, "Not found");
      if (item.version !== version) throw new HttpError(409, "Conflict");
      rows.delete(key);
    },
    locations: async () => [],
    createLocation: async (name) => ({ id, name, user_id: id }),
    updateLocation: async (key, name) => ({ id: key, name, user_id: id }),
    removeLocation: async () => {},
  };
  const ctx: RequestContext = { userId: id, repository: repo };
  return { rows, actors, ctx };
}
it("validates space edits and rejects unsafe deletions", async () => {
  const { ctx } = setup();
  const response = await handleLocations(
    request("PATCH", { id, name: "Office" }),
    ctx,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    location: { id, user_id: id, name: "Office" },
  });
  expect(
    (await handleLocations(request("DELETE", { id, destinationId: id }), ctx))
      .status,
  ).toBe(400);
  expect(
    (
      await handleLocations(
        request("DELETE", { id, destinationId: null }, "https://evil.example"),
        ctx,
      )
    ).status,
  ).toBe(403);
  expect(
    (await handleLocations(request("PATCH", { id, name: " " }), ctx)).status,
  ).toBe(400);
});
function request(
  method: string,
  body?: unknown,
  origin = "http://localhost:3000",
) {
  return new Request("http://localhost:3000/api/items", {
    method,
    headers: { origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
it("accepts six bounded conversation turns on the saved inventory API", async () => {
  const history = Array.from({ length: 6 }, () => ({
    question: "camera",
    answer: "a".repeat(3000),
  }));
  const { ctx } = setup();
  const response = await handleAsk(
    request("POST", { question: "Where is it?", history }),
    ctx,
  );
  expect(response.status).toBe(200);
});
it("rejects unauthenticated inventory access", async () =>
  expect((await handleItems(request("GET"), null)).status).toBe(401));
it("rejects a cross-origin mutation before writing", async () => {
  const { ctx, rows } = setup();
  expect(
    (
      await handleItems(
        request("POST", { name: "Charger" }, "https://evil.example"),
        ctx,
      )
    ).status,
  ).toBe(403);
  expect(rows.size).toBe(0);
});
it("rejects malformed JSON and ownership injection", async () => {
  const { ctx, rows } = setup();
  const malformed = new Request("http://localhost:3000/api/items", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: "{",
  });
  expect((await handleItems(malformed, ctx)).status).toBe(400);
  expect(
    (await handleItems(request("POST", { name: "Charger", user_id: id }), ctx))
      .status,
  ).toBe(400);
  expect(rows.size).toBe(0);
});
it("rejects the removed lost status at the API boundary", async () => {
  const { ctx, rows } = setup();
  const response = await handleItems(
    request("POST", { name: "Camera", status: "lost" }),
    ctx,
  );
  expect(response.status).toBe(400);
  expect(rows.size).toBe(0);
});
it("records explicit Jarvis mutation provenance and rejects unknown actors", async () => {
  const { ctx, actors } = setup();
  const jarvis = request("POST", { name: "Camera" });
  jarvis.headers.set("x-inventory-actor", "jarvis");
  expect((await handleItems(jarvis, ctx)).status).toBe(201);
  expect(actors).toEqual(["jarvis"]);
  const invalid = request("POST", { name: "Tripod" });
  invalid.headers.set("x-inventory-actor", "sensor");
  expect((await handleItems(invalid, ctx)).status).toBe(400);
  expect(actors).toEqual(["jarvis"]);
});
it("serves and acknowledges an authenticated dashboard briefing", async () => {
  let acknowledged = "";
  const { ctx } = setup();
  ctx.dashboard = {
    briefing: async () => ({
      asOf: "2026-09-19T12:00:00.000Z",
      lastVisitedAt: null,
      activityHeading: "Recent inventory activity",
      summary: "No recent inventory activity has been recorded yet.",
      activityCount: 0,
      hasMore: false,
      groups: [],
      suggestion: null,
    }),
    acknowledge: async (asOf) => {
      acknowledged = asOf;
    },
  };
  const response = await handleDashboard(request("GET"), ctx);
  expect(response.status).toBe(200);
  expect((await response.json()).groups).toEqual([]);
  const asOf = "2026-09-19T12:00:00.000Z";
  expect(
    (await handleDashboardVisit(request("POST", { asOf }), ctx)).status,
  ).toBe(200);
  expect(acknowledged).toBe(asOf);
  expect(
    (
      await handleDashboardVisit(
        request("POST", { asOf }, "https://evil.example"),
        ctx,
      )
    ).status,
  ).toBe(403);
});
it("supports create, read, update and delete with a stale edit guard", async () => {
  const { ctx, rows } = setup();
  const input = itemInput.parse({ name: "Charger" });
  expect((await handleItems(request("POST", input), ctx)).status).toBe(201);
  expect(
    (await (await handleItems(request("GET"), ctx)).json()).items,
  ).toHaveLength(1);
  expect(
    (
      await handleItem(
        request("PUT", { ...input, name: "USB-C charger", version: 1 }),
        id,
        ctx,
      )
    ).status,
  ).toBe(200);
  expect(rows.get(id)?.name).toBe("USB-C charger");
  expect(
    (await handleItem(request("PUT", { ...input, version: 1 }), id, ctx))
      .status,
  ).toBe(409);
  expect(
    (await handleItem(request("DELETE", { version: 2 }), id, ctx)).status,
  ).toBe(200);
  expect(rows.size).toBe(0);
});
it("validates item IDs before database use", async () =>
  expect(
    (await handleItem(request("DELETE", { version: 1 }), "bad", setup().ctx))
      .status,
  ).toBe(400));
it("keeps ask authenticated and read-only", async () => {
  const { ctx, rows } = setup();
  await ctx.repository.create(itemInput.parse({ name: "Charger" }));
  expect(
    (await handleAsk(request("POST", { question: "charger" }), null)).status,
  ).toBe(401);
  expect(
    (await handleAsk(request("POST", { question: "Delete my charger" }), ctx))
      .status,
  ).toBe(200);
  expect(rows.size).toBe(1);
});
