import { expect, it, vi } from "vitest";
import { handleAsk, handleInventoryContents } from "../src/lib/handlers";
import { itemInput, type Item, type Location } from "../src/lib/inventory";
import type { InventoryRepository } from "../src/lib/contracts";
import type { RequestContext } from "../src/lib/http";
import type { AskResult } from "../src/lib/ask";
import type { InventoryResult } from "../src/lib/inventory-scope";

const id = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const owner = id(1);
const places: Location[] = [
  { id: id(2), user_id: owner, name: "Home" },
  { id: id(3), user_id: owner, name: "Cabin" },
  { id: id(4), user_id: owner, name: "Bedroom", parent_location_id: id(2) },
  { id: id(5), user_id: owner, name: "Bedroom", parent_location_id: id(3) },
];
function row(
  n: number,
  name: string,
  location: string | null,
  parent: string | null = null,
  container = false,
): Item {
  return {
    ...itemInput.parse({
      name,
      kind: container ? "container" : "durable",
      location_id: location,
      parent_container_id: parent,
    }),
    id: id(n),
    user_id: owner,
    version: 1,
    created_at: "2026-10-13",
    updated_at: "2026-10-13",
    location_name: null,
    description: "A".repeat(2000),
  };
}
const homeRows = [
  row(10, "Box", id(4), null, true),
  row(11, "Inner box", null, id(10), true),
  row(12, "Home direct", id(2)),
  ...Array.from({ length: 255 }, (_, i) =>
    row(100 + i, i % 2 ? "Cable" : "Supply", null, id(11)),
  ),
];
const rows = [
  ...homeRows,
  row(400, "Box", id(5), null, true),
  row(401, "Cabin cable", null, id(400)),
];
function context() {
  const forbidden = vi.fn(async () => {
    throw new Error("Read-only request attempted a mutation");
  });
  const repository: InventoryRepository = {
    list: vi.fn(async (q) => (q ? rows.slice(0, 20) : rows)),
    locations: async () => places,
    create: forbidden,
    update: forbidden,
    remove: forbidden,
    createLocation: forbidden,
    updateLocation: forbidden,
    removeLocation: forbidden,
  };
  return {
    ctx: { userId: owner, repository } satisfies RequestContext,
    forbidden,
  };
}
function ask(
  question: string,
  history?: { question: string; answer: string }[],
) {
  return new Request("http://localhost:3000/api/ask", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify({ question, history }),
  });
}
function contents(scope: InventoryResult["scope"], offset: number) {
  return new Request(
    `http://localhost:3000/api/inventory/contents?type=${scope.type}&id=${scope.id}&offset=${offset}`,
  );
}

it("returns every exact location record through Ask and continuation pages, beyond both old caps and the page byte budget", async () => {
  const { ctx, forbidden } = context();
  const provider = {
    answer: vi.fn(async () => ({
      answer: "Only the first record",
      itemIds: [id(10)],
    })),
  };
  const response = await handleAsk(
    ask("Show me everything in Home"),
    ctx,
    provider,
  );
  expect(response.status).toBe(200);
  const result: AskResult = await response.json();
  let page = result.inventoryResult!;
  expect(page.total).toBe(homeRows.length);
  expect(page.items.length).toBeLessThan(100);
  expect(result.answer).toMatch(/load the next page/i);
  const actual: string[] = [];
  let visits = 0;
  while (true) {
    expect(++visits).toBeLessThan(10);
    actual.push(...page.items.map((item) => item.id));
    if (page.nextOffset === null) break;
    expect(page.nextOffset).toBeGreaterThan(page.offset);
    const next = await handleInventoryContents(
      contents(page.scope, page.nextOffset),
      ctx,
    );
    expect(next.status).toBe(200);
    page = await next.json();
    expect(page.total).toBe(homeRows.length);
  }
  expect(actual).toEqual(homeRows.map((row) => row.id));
  expect(new Set(actual).size).toBe(homeRows.length);
  expect(provider.answer).not.toHaveBeenCalled();
  expect(forbidden).not.toHaveBeenCalled();
  expect(ctx.repository.list).toHaveBeenCalledWith("");
});

it("clarifies duplicate room/container names and keeps chained location follow-ups scoped without mutations", async () => {
  const { ctx, forbidden } = context();
  const ambiguous: AskResult = await (
    await handleAsk(ask("Show me everything in Bedroom"), ctx)
  ).json();
  expect(
    ambiguous.scopeChoices?.map((choice) => choice.path.join(" → ")),
  ).toEqual(["Home → Bedroom", "Cabin → Bedroom"]);
  expect(ambiguous.citations).toEqual([]);
  const selected: AskResult = await (
    await handleAsk(
      ask("Cabin → Bedroom", [
        { question: "Show me everything in Bedroom", answer: ambiguous.answer },
      ]),
      ctx,
    )
  ).json();
  expect(selected.inventoryResult?.scope.id).toBe(id(5));
  expect(selected.inventoryResult?.items.map((item) => item.id)).toEqual([
    id(400),
    id(401),
  ]);
  const history: { question: string; answer: string }[] = [];
  for (const question of [
    "Show me everything in Home",
    "and in Cabin?",
    "what about Home?",
  ]) {
    const result: AskResult = await (
      await handleAsk(ask(question, history), ctx)
    ).json();
    expect(result.inventoryResult?.total).toBe(
      question.includes("Cabin") ? 2 : homeRows.length,
    );
    history.push({ question, answer: result.answer });
  }
  const containers: AskResult = await (
    await handleAsk(ask("Show me everything in Box"), ctx)
  ).json();
  expect(containers.scopeChoices).toHaveLength(2);
  expect(containers.citations).toEqual([]);
  expect(forbidden).not.toHaveBeenCalled();
});

it("rejects unavailable or unauthenticated scope continuation instead of revealing another inventory", async () => {
  const { ctx, forbidden } = context();
  const foreign = {
    type: "location" as const,
    id: id(999),
    name: "Foreign",
    path: ["Foreign"],
  };
  expect(
    (await handleInventoryContents(contents(foreign, 0), ctx)).status,
  ).toBe(404);
  expect(
    (await handleInventoryContents(contents(foreign, 0), null)).status,
  ).toBe(401);
  expect(
    (
      await handleInventoryContents(
        contents({ ...foreign, id: id(2) }, -1),
        ctx,
      )
    ).status,
  ).toBe(400);
  expect(forbidden).not.toHaveBeenCalled();
});

it("rejects a stale continuation after inventory changes and allows a fresh scope query", async () => {
  const { ctx } = context();
  const first: AskResult = await (
    await handleAsk(ask("Show me everything in Home"), ctx)
  ).json();
  const page = first.inventoryResult!;
  expect(page.revision).toEqual(expect.any(String));
  vi.mocked(ctx.repository.list).mockResolvedValue(
    rows.map((row) => (row.id === id(12) ? { ...row, version: 2 } : row)),
  );
  const nextUrl = new URL(contents(page.scope, page.nextOffset!).url);
  nextUrl.searchParams.set("revision", page.revision!);
  const stale = await handleInventoryContents(new Request(nextUrl), ctx);
  expect(stale.status).toBe(409);
  expect((await stale.json()).error).toMatch(/inventory changed while paging/i);
  const restarted = await handleInventoryContents(contents(page.scope, 0), ctx);
  expect(restarted.status).toBe(200);
  const fresh: InventoryResult = await restarted.json();
  expect(fresh.revision).not.toBe(page.revision);
  expect(fresh.total).toBe(homeRows.length);
});
