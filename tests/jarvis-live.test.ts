import { expect, it } from "vitest";
import type { InventoryFact } from "../src/lib/ask";
import { configuredProvider } from "../src/lib/provider";
import { askInventory } from "../src/lib/ask";
import { searchFacts } from "../src/lib/inventory-search";

it
  .skipIf(!process.env.JARVIS_LIVE_TEST)
  .each([
    "Help me pack for camping for two nights.",
    "Help me pack for a two-night work trip.",
  ])(
  "includes personal essentials for %s",
  async (question) => {
    const make = (
      id: string,
      name: string,
      category: string,
      extra: Partial<InventoryFact> = {},
    ): InventoryFact => ({
      id,
      name,
      category,
      description: "Fabricated test inventory",
      quantity: 1,
      unit: "pc",
      status: "active",
      condition: "good",
      location_name: "Test home → Cabinet",
      tags: [],
      attributes: {},
      ...extra,
    });
    const rows = [
      ...Array.from({ length: 25 }, (_, i) =>
        make(`desk-${i}`, `Desk ornament ${i}`, "Decor"),
      ),
      make("contacts", "Daily contact lenses", "Personal care", {
        quantity: 12,
        unit: "pairs",
      }),
      make("bandages", "Bandages", "First aid", { quantity: 10 }),
      make("guard", "Night guard", "Personal care", {
        description: "Worn every night; keep in protective case.",
      }),
      make("bag", "Travel backpack", "Bags"),
      make("water", "Water bottle", "Everyday carry"),
      make("tent", "Two-person tent", "Camping"),
      make("sleep", "Sleeping bag", "Camping"),
      make("light", "Headlamp", "Camping"),
      make("soap", "Soap", "Personal care"),
      make("empty", "Contact lens solution", "Personal care", { quantity: 0 }),
      make("disposed", "Rain jacket", "Clothing", { status: "disposed" }),
    ];
    const result = await askInventory(
      question,
      { search: async (q) => searchFacts(rows, q) },
      configuredProvider(),
    );
    expect(result.mode, result.notice).toBe("ai");
    expect(result.citations.map((i) => i.id)).toEqual(
      expect.arrayContaining(["contacts", "guard", "bag"]),
    );
    expect(result.answer).toMatch(/contact/i);
    expect(result.answer).toMatch(/night guard/i);
    if (question.includes("camping")) {
      expect(result.citations.map((i) => i.id)).toEqual(
        expect.arrayContaining(["bandages", "tent", "sleep"]),
      );
    }
    // Unavailable items can be mentioned as gaps, but not listed as packable.
    expect(result.answer).not.toMatch(
      /pack (?:your |the )?(?:contact lens solution|rain jacket)/i,
    );
  },
  30000,
);

it.skipIf(!process.env.JARVIS_LIVE_TEST)(
  "answers a fabricated inventory fixture through the configured model",
  async () => {
    const item = {
      id: "synthetic-test-1",
      name: "Synthetic test camera",
      description: "Fabricated integration-test fixture, not a real possession",
      category: "Test data",
      quantity: 1,
      unit: "pc",
      status: "stored" as const,
      condition: "good" as const,
      location_name: "Test shelf",
      tags: [],
      attributes: {},
    };
    try {
      const result = await configuredProvider()!.answer({
        question: "Where is the synthetic test camera?",
        items: [item],
      });
      expect(result).toMatchObject({ itemIds: ["synthetic-test-1"] });
    } catch (error) {
      const e = error as Error & { status?: number };
      const message = e.message.replaceAll(
        process.env.AI_API_KEY || "[no key]",
        "[REDACTED]",
      );
      throw new Error(
        JSON.stringify({ name: e.name, status: e.status, message }),
      );
    }
  },
  30000,
);

it.skipIf(!process.env.JARVIS_LIVE_TEST)(
  "answers Pack me for camping",
  async () => {
    const { askInventory, inventoryFacts } = await import("../src/lib/ask");
    const { searchFacts } = await import("../src/lib/inventory-search");
    const sampleItems: InventoryFact[] = [
      {
        id: "backpack",
        name: "Backpack",
        description:
          "Main backpack for school and travel. Fits a 15-inch laptop.",
        category: "Everyday carry",
        quantity: 1,
        unit: "pc",
        status: "active" as const,
        condition: "good" as const,
        location_name: "College",
        tags: ["school", "travel", "everyday"],
        attributes: { color: "Black" },
      },
      {
        id: "water-bottle",
        name: "Water bottle",
        description: "One-liter bottle for long days away from home.",
        category: "Everyday carry",
        quantity: 1,
        unit: "pc",
        status: "active" as const,
        condition: "good" as const,
        location_name: "College",
        tags: ["daily", "gym"],
        attributes: {},
      },
      {
        id: "sneakers",
        name: "Sneakers",
        description: "Everyday white sneakers.",
        category: "Clothing",
        quantity: 1,
        unit: "pair",
        status: "active" as const,
        condition: "fair" as const,
        location_name: "Bedroom",
        tags: ["everyday"],
        attributes: {},
      },
    ];
    const facts = inventoryFacts(sampleItems);
    const result = await askInventory(
      "Pack me for camping",
      { search: async (q) => searchFacts(facts, q) },
      configuredProvider(),
    );
    if (result.notice) {
      throw new Error("FAILED_AI_FALLBACK: " + JSON.stringify(result));
    }
    expect(result.mode).toBe("ai");
  },
  30000,
);
