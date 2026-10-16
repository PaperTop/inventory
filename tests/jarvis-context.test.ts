import { AIMessage } from "@langchain/core/messages";
import { expect, it } from "vitest";
import { askInventory, type InventoryFact } from "../src/lib/ask";
import { createReadOnlyAnswerGraph } from "../src/lib/answer-graph";
import { searchFacts } from "../src/lib/inventory-search";

const fact = (id: string, name: string): InventoryFact => ({
  id,
  name,
  description: "",
  category: "Personal care",
  quantity: 1,
  unit: "pc",
  status: "active",
  condition: "good",
  location_name: "Bathroom → Cabinet",
  tags: [],
  attributes: {},
});

it("shows personal possessions outside initial matches, then retrieves their full evidence", async () => {
  const rows = [
    fact("contact", "Daily contact lenses"),
    fact("bandage", "Bandages"),
  ];
  let turn = 0;
  let sawOverview = false;
  const provider = createReadOnlyAnswerGraph({
    async invoke(messages) {
      if (++turn === 1) {
        const context = JSON.parse(String(messages[1].content));
        sawOverview = context.inventoryOverview?.items.some(
          (i: { name: string }) => i.name === "Daily contact lenses",
        );
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "personal",
              name: "search_inventory",
              args: { query: "contact bandage" },
            },
          ],
        });
      }
      return new AIMessage(
        JSON.stringify({
          answer:
            "Pack your contact lenses and bandages from the bathroom cabinet.",
          itemIds: ["contact", "bandage"],
        }),
      );
    },
  });
  const result = await askInventory(
    "Help me prepare for a weekend away — basic list",
    { search: async (q) => searchFacts(rows, q) },
    provider,
  );
  expect(sawOverview).toBe(true);
  expect(result.mode).toBe("ai");
  expect(result.citations.map((i) => i.id)).toEqual(["contact", "bandage"]);
});

it("pages past the first 20 matches and validates citations from later pages", async () => {
  const rows = Array.from({ length: 25 }, (_, i) =>
    fact(`item-${i}`, `Travel supply ${i}`),
  );
  let turn = 0;
  let page: { items: InventoryFact[]; nextOffset: number | null } | undefined;
  const provider = createReadOnlyAnswerGraph({
    async invoke(messages) {
      if (++turn === 1)
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "page",
              name: "search_inventory",
              args: { query: "travel", offset: 20 },
            },
          ],
        });
      page = JSON.parse(String(messages.at(-2)?.content));
      return new AIMessage(
        JSON.stringify({
          answer: "Supply 24 is in the bathroom cabinet.",
          itemIds: ["item-24"],
        }),
      );
    },
  });
  const result = await askInventory(
    "Prepare for a trip — basic list",
    { search: async (q) => searchFacts(rows, q) },
    provider,
  );
  expect(page?.items.map((i) => i.id)).toEqual([
    "item-20",
    "item-21",
    "item-22",
    "item-23",
    "item-24",
  ]);
  expect(page?.nextOffset).toBeNull();
  expect(result.mode).toBe("ai");
  expect(result.citations[0].id).toBe("item-24");
});

it("does not allow a catalogue-only record to be cited as inspected evidence", async () => {
  let browsed = false;
  const result = await askInventory(
    "Find desk furniture",
    {
      search: async (q) => searchFacts([fact("contacts", "Contact lenses")], q),
    },
    {
      async answer(_context, reader) {
        await reader!.overview!();
        browsed = true;
        return { answer: "Pack lenses.", itemIds: ["contacts"] };
      },
    },
  );
  expect(result.mode).toBe("search");
  expect(browsed).toBe(true);
  expect(result.notice).toBeTruthy();
});

it("bounds the overview and lets the agent browse more categories and records", async () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    ...fact(`id-${i}`, `Item ${i} ${"n".repeat(140)}`),
    category: `Category ${i}`,
    description: "d".repeat(2000),
  }));
  let checked = false;
  let snapshots = 0;
  const result = await askInventory(
    "unmatched",
    {
      search: async (q) => {
        if (!q) snapshots++;
        return searchFacts(rows, q);
      },
    },
    {
      async answer(_context, reader) {
        const first = await reader!.overview!();
        expect(first.totalItems).toBe(100);
        expect(first.categoriesLimited).toBe(true);
        expect(JSON.stringify(first).length).toBeLessThan(13000);
        const second = await reader!.overview!(first.nextOffset!);
        expect(second.items[0].id).toBe(`id-${first.items.length}`);
        const found = await reader!.search("Item 99");
        expect(found[0].id).toBe("id-99");
        checked = true;
        return { answer: "Found item 99.", itemIds: ["id-99"] };
      },
    },
  );
  expect(result.mode).toBe("ai");
  expect(checked).toBe(true);
  expect(snapshots).toBe(1);
});

it("reports character-limited pages accurately and can resume without skipping records", async () => {
  const rows = Array.from({ length: 24 }, (_, i) => ({
    ...fact(`item-${i}`, `Supply ${i}`),
    description: "x".repeat(2000),
  }));
  let checked = false;
  const result = await askInventory(
    "trip",
    { search: async () => rows },
    {
      async answer(_context, reader) {
        const first = await reader!.searchPage!("", 0);
        expect(first.items.length).toBeLessThan(20);
        expect(first.nextOffset).toBe(first.items.length);
        const second = await reader!.searchPage!("", first.nextOffset!);
        expect(second.items[0].id).toBe(`item-${first.items.length}`);
        expect(first.limited).toBe(true);
        checked = true;
        return { answer: "Found supplies.", itemIds: [second.items[0].id] };
      },
    },
  );
  expect(checked).toBe(true);
  expect(result.mode).toBe("ai");
});
