import { expect, it } from "vitest";
import { askInventory, type InventoryFact } from "../src/lib/ask";
import { configuredProvider } from "../src/lib/provider";
import { searchFacts } from "../src/lib/inventory-search";
import type { JarvisDiagnostic } from "../src/lib/jarvis-diagnostics";

// Fixed, opt-in measurement; synthetic inventory only, no automatic retries.
it.skipIf(!process.env.JARVIS_FALLBACK_SAMPLE)(
  "answers a fixed three-request fixture without fallback",
  async () => {
    const rows: InventoryFact[] = [
      ["Backpack", "Bags"],
      ["Water bottle", "Everyday carry"],
      ["Sneakers", "Clothing"],
      ["Hoodie", "Clothing"],
      ["Two-person tent", "Camping"],
      ["Sleeping bag", "Camping"],
      ["Headlamp", "Camping"],
      ["Contact lenses", "Personal care"],
      ["Contact lens case", "Personal care"],
      ["Night guard", "Personal care"],
      ["Camera", "Photography"],
      ["Camera battery", "Photography"],
      ["USB charging cable", "Electronics"],
      ["Travel tripod", "Photography"],
      ["SD memory card", "Photography"],
      ["Rain jacket", "Clothing"],
    ].map(([name, category], index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      name,
      category,
      description: "Synthetic test possession",
      quantity: 1,
      unit: "pc",
      status: "active",
      condition: "good",
      location_name: "Test home → Bedroom → Cabinet",
      tags: [],
      attributes: {},
    }));
    const provider = configuredProvider();
    expect(provider).toBeDefined();
    const outcomes: string[] = [];
    for (const [index, question] of [
      "Help me pack for Lake Tahoe camping, 3 days and 2 nights, at a campground with a tent. Expected weather is cold and rainy. Give me a basic list without more questions.",
      "What accessories do I have for taking pictures? Explain their uses without assuming compatibility.",
      "Help me pack for a two-night business trip to Chicago, staying in a hotel, mild weather. Include my daily essentials. Basic list, no questions.",
    ].entries()) {
      const events: JarvisDiagnostic[] = [];
      const start = performance.now();
      const result = await askInventory(
        question,
        {
          search: async (query) => searchFacts(rows, query),
          diagnose: (event) => events.push(event),
        },
        provider,
      );
      console.info(
        JSON.stringify({
          sample: index + 1,
          mode: result.mode,
          clarification: Boolean(result.clarification),
          elapsedMs: Math.round(performance.now() - start),
          events,
        }),
      );
      expect(
        result.citations.every((item) =>
          rows.some((row) => row.id === item.id),
        ),
      ).toBe(true);
      expect(result.changes).toBeUndefined();
      outcomes.push(result.mode);
    }
    expect(outcomes).toEqual(["ai", "ai", "ai"]);
  },
  90000,
);
