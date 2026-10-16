import { expect, it, vi } from "vitest";
import { askInventory, type InventoryFact } from "../src/lib/ask";
import { searchFacts } from "../src/lib/inventory-search";
import { itemInput, searchInventory } from "../src/lib/inventory";

const fact = (id: string, name: string, category: string): InventoryFact => ({
  id,
  name,
  category,
  description: "Synthetic greeting regression fixture",
  quantity: 1,
  unit: "pc",
  status: "active",
  condition: "good",
  location_name: "Test shelf",
  tags: [],
  attributes: {},
});
const rows = [
  fact("shoes", "Sneakers", "Clothing"),
  fact("hoodie", "Hoodie", "Clothing"),
  fact("vest", "Hi-vis vest", "Safety"),
];
it.each([
  "hi",
  "Hi!",
  "hello",
  "hey",
  "help",
  "thanks",
  "how are you",
  "what can you do",
])(
  "responds conversationally to %s without arbitrary inventory cards",
  async (question) => {
    const search = vi.fn(async (query: string) => searchFacts(rows, query));
    const provider = {
      answer: vi.fn(async () => ({ answer: "Model not needed", itemIds: [] })),
    };
    const result = await askInventory(question, { search }, provider);
    expect(search).not.toHaveBeenCalled();
    expect(provider.answer).not.toHaveBeenCalled();
    expect(result.citations).toEqual([]);
    expect(result.clarification).not.toBe(true);
    expect(result.answer).not.toMatch(
      /Sneakers|Hoodie|Hi-vis vest|No matching items found/i,
    );
    expect(result.answer).toMatch(
      /hello|hi\b|help|welcome|ask|inventory|you.re welcome|glad/i,
    );
    expect(result.changes).toBeUndefined();
  },
);

it("does not turn an unknown query into arbitrary records", async () => {
  const result = await askInventory("quuxzzwidget", {
    search: async (query) => searchFacts(rows, query),
  });
  expect(result.citations).toEqual([]);
  expect(result.answer).toMatch(/No matching items/);
});

it("a literal hi-vis fallback search does not pull in unrelated Clothing records through the short hi substring", async () => {
  const result = await askInventory("hi-vis vest", {
    search: async (query) => searchFacts(rows, query),
  });
  expect(result.citations.map((row) => row.id)).toEqual(["vest"]);
});

it("retains useful short SD and USB prefix searches without matching embedded short tokens", async () => {
  const facts = [
    ...rows,
    fact("sd", "SD card", "Electronics"),
    fact("usb", "USB-C cable", "Electronics"),
    fact("noise", "Outside lamp", "Lighting"),
  ];
  expect(searchFacts(facts, "sd").map((row) => row.id)).toEqual(["sd"]);
  expect(searchFacts(facts, "usb").map((row) => row.id)).toEqual(["usb"]);
  const items = facts.map((row) => ({
    ...itemInput.parse({ name: row.name, category: row.category }),
    ...row,
    user_id: "local",
    kind: "durable" as const,
    version: 1,
    created_at: "2026-10-16",
    updated_at: "2026-10-16",
  }));
  expect(searchInventory(items, "sd").map((row) => row.id)).toEqual(["sd"]);
  expect(searchInventory(items, "hi-vis").map((row) => row.id)).toEqual([
    "vest",
  ]);
});

it.each(["hi-vis vest", "hiking"])(
  "does not mistake a real %s query for a greeting",
  async (question) => {
    const provider = {
      answer: vi.fn(async () => ({
        answer: "Here are the requested inventory matches.",
        itemIds: question === "hiking" ? ["shoes"] : ["vest"],
      })),
    };
    const result = await askInventory(
      question,
      { search: async (query) => searchFacts(rows, query) },
      provider,
    );
    expect(provider.answer).toHaveBeenCalledOnce();
    expect(result.mode).toBe("ai");
    expect(result.citations.map((row) => row.id)).toContain(
      question === "hiking" ? "shoes" : "vest",
    );
  },
);

it("a greeting followed by an inventory request still answers the actual request", async () => {
  const provider = {
    answer: vi.fn(async () => ({
      answer: "Sneakers are on Test shelf.",
      itemIds: ["shoes"],
    })),
  };
  const result = await askInventory(
    "Hi, where are my sneakers?",
    { search: async (query) => searchFacts(rows, query) },
    provider,
  );
  expect(provider.answer).toHaveBeenCalledOnce();
  expect(result.mode).toBe("ai");
  expect(result.citations.map((row) => row.id)).toEqual(["shoes"]);
});
