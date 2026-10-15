import { expect, it } from "vitest";
import {
  inventoryContents,
  resolveScopeName,
  scopeChoices,
} from "../src/lib/inventory-scope";
import { itemInput, type Item, type Location } from "../src/lib/inventory";
import { askInventory } from "../src/lib/ask";
import { handleAsk } from "../src/lib/handlers";
import type { InventoryRepository } from "../src/lib/contracts";

const places: Location[] = [
  { id: "home", user_id: "owner", name: "Home" },
  { id: "cabin", user_id: "owner", name: "Cabin" },
  {
    id: "bedroom",
    user_id: "owner",
    name: "Bedroom",
    parent_location_id: "home",
  },
  {
    id: "cabin-bedroom",
    user_id: "owner",
    name: "Bedroom",
    parent_location_id: "cabin",
  },
];
function row(
  id: string,
  location_id: string | null,
  parent_container_id: string | null = null,
  kind: "container" | "durable" = "durable",
): Item {
  return {
    ...itemInput.parse({ name: id }),
    id,
    user_id: "owner",
    location_id,
    parent_container_id,
    kind,
    location_name: null,
    version: 1,
    created_at: "",
    updated_at: "",
    description: "n".repeat(2000),
  };
}
const rows = [
  row("box", "bedroom", null, "container"),
  ...Array.from({ length: 275 }, (_, i) => row(`supply-${i}`, null, "box")),
  row("direct", "home"),
  row("other", "cabin-bedroom"),
];
it("pages all space descendants exactly once beyond search and context limits", () => {
  let offset = 0;
  const ids: string[] = [];
  do {
    const page = inventoryContents(
      rows,
      places,
      { type: "location", id: "home" },
      offset,
    );
    expect(page.total).toBe(277);
    expect(page.items.length).toBeLessThanOrEqual(100);
    ids.push(...page.items.map((row) => row.id));
    if (page.nextOffset === null) break;
    expect(page.complete).toBe(false);
    offset = page.nextOffset;
  } while (true);
  expect(ids).toHaveLength(277);
  expect(new Set(ids).size).toBe(277);
  expect(ids).not.toContain("other");
  expect(
    inventoryContents(rows, places, { type: "container", id: "box" }).total,
  ).toBe(275);
});
it("clarifies duplicate room names and resolves full/natural paths", () => {
  const choices = scopeChoices(rows, places);
  expect(resolveScopeName("the bedroom", choices)).toHaveLength(2);
  expect(resolveScopeName("Home > Bedroom", choices)[0].id).toBe("bedroom");
  expect(resolveScopeName("the Bedroom in my Cabin", choices)[0].id).toBe(
    "cabin-bedroom",
  );
  expect(
    resolveScopeName("Living Room", [
      {
        type: "location",
        id: "living",
        name: "Living Room",
        path: ["Home", "Living Room"],
      },
    ])[0].id,
  ).toBe("living");
});
it("rejects continuation after matching inventory or placement changes", () => {
  const first = inventoryContents(rows, places, {
    type: "location",
    id: "home",
  });
  const changed = rows.map((row, index) =>
    index === 1 ? { ...row, version: row.version + 1 } : row,
  );
  expect(() =>
    inventoryContents(
      changed,
      places,
      { type: "location", id: "home" },
      first.nextOffset!,
      first.revision,
    ),
  ).toThrow(/changed while paging/i);
  expect(
    inventoryContents(
      rows,
      places,
      { type: "location", id: "home" },
      first.nextOffset!,
      first.revision,
    ).offset,
  ).toBe(first.nextOffset);
});
it("answers exhaustive location requests through structured pages even without a provider", async () => {
  const reader = {
    search: async () => rows.slice(0, 20),
    snapshot: async () => ({ items: rows, locations: places }),
  };
  const ambiguous = await askInventory("Show me everything in Bedroom", reader);
  expect(ambiguous.scopeChoices).toHaveLength(2);
  expect(ambiguous.citations).toEqual([]);
  const result = await askInventory("Show me all my items in Home", reader);
  expect(result.inventoryResult?.total).toBe(277);
  expect(result.inventoryResult?.nextOffset).toBe(100);
  expect(result.answer).toMatch(/load the next page/i);
  expect(result.answer).not.toMatch(/All results are shown/);
  expect(result.citations.length).toBeLessThanOrEqual(20);
});
it("retains exhaustive location semantics through chained follow-ups and breadcrumb replies", async () => {
  const reader = {
    search: async () => rows.slice(0, 20),
    snapshot: async () => ({ items: rows, locations: places }),
  };
  const history = [
    { question: "Show me everything in Home", answer: "Recorded inventory." },
    { question: "and in Cabin?", answer: "Recorded inventory." },
  ];
  const result = await askInventory(
    "what about Home?",
    reader,
    undefined,
    history,
  );
  expect(result.inventoryResult?.total).toBe(277);
  const clarified = await askInventory("Home → Bedroom", reader, undefined, [
    { question: "Show everything in Bedroom", answer: "Which Bedroom?" },
  ]);
  expect(clarified.inventoryResult?.scope.id).toBe("bedroom");
});
it("grounds packing in the complete authenticated snapshot rather than the capped search RPC", async () => {
  const inventory = [
    ...Array.from({ length: 250 }, (_, index) => ({
      ...row(`ornament-${index}`, "home"),
      description: "Desk decoration",
    })),
    {
      ...row("Contact lenses", "bedroom"),
      description: "Daily personal care",
      category: "Personal care",
    },
    { ...row("Water bottle", "home"), description: "One litre bottle" },
    { ...row("Tent", "home"), status: "lent" as const },
  ];
  const forbidden = async () => {
    throw new Error("No mutation allowed");
  };
  const repository: InventoryRepository = {
    list: async (q) => (q ? inventory.slice(0, 200) : inventory),
    locations: async () => places,
    create: forbidden,
    update: forbidden,
    remove: forbidden,
    createLocation: forbidden,
    updateLocation: forbidden,
    removeLocation: forbidden,
  };
  const request = new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify({ question: "Pack me for camping" }),
  });
  const response = await handleAsk(request, { userId: "owner", repository });
  const result = await response.json();
  expect(result.citations.map((row: { id: string }) => row.id)).toContain(
    "Contact lenses",
  );
  expect(result.citations.map((row: { id: string }) => row.id)).toContain(
    "Water bottle",
  );
  expect(result.citations.map((row: { id: string }) => row.id)).not.toContain(
    "Tent",
  );
  expect(result.answer).toMatch(/not a complete camping checklist/i);
});
