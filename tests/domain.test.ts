import { describe, expect, it } from "vitest";
import { itemInput, searchInventory, type Item } from "../src/lib/inventory";
import { askInventory } from "../src/lib/ask";
import { reconcile } from "../src/lib/reconciliation";

export const owner = "11111111-1111-4111-8111-111111111111";
export const jacket: Item = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: owner,
  name: "Winter jacket",
  kind: "durable",
  description: "Warm insulated coat",
  category: "Clothing",
  quantity: 1,
  unit: "item",
  reorder_threshold: null,
  location_id: null,
  location_name: "Closet",
  tags: ["travel", "winter"],
  attributes: { color: "blue" },
  status: "active",
  condition: "good",
  version: 2,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};
const input = {
  name: " Rice ",
  kind: "consumable",
  quantity: 1.5,
  unit: "kg",
  tags: [" Food ", "food"],
};
describe("inventory invariants", () => {
  it("preserves fractional stock and normalizes names/tags", () =>
    expect(itemInput.parse(input)).toMatchObject({
      name: "Rice",
      quantity: 1.5,
      tags: ["food"],
    }));
  it.each([-1, NaN, Infinity])("rejects invalid quantity %s", (quantity) =>
    expect(itemInput.safeParse({ ...input, quantity }).success).toBe(false),
  );
  it("rejects fractional or multiple durable items", () =>
    expect(
      itemInput.safeParse({ name: "Laptop", kind: "durable", quantity: 2 })
        .success,
    ).toBe(false));
  it("rejects injected ownership", () =>
    expect(itemInput.safeParse({ ...input, user_id: owner }).success).toBe(
      false,
    ));
  it("rejects array attributes", () =>
    expect(itemInput.safeParse({ ...input, attributes: [] }).success).toBe(
      false,
    ));
  it("finds inventory through tags, attributes and location", () => {
    for (const q of ["travel", "blue", "closet"])
      expect(searchInventory([jacket], q).map((i) => i.id)).toEqual([
        jacket.id,
      ]);
  });
  it("does not return unrelated possessions", () =>
    expect(searchInventory([jacket], "toothpaste")).toEqual([]));
});
describe("read-only inventory answers", () => {
  const reader = { search: async (q: string) => searchInventory([jacket], q) };
  it("grounds a natural language lookup in matching possessions", async () => {
    const result = await askInventory("Where is my winter jacket?", reader);
    expect(result.citations.map((i) => i.id)).toEqual([jacket.id]);
    expect(result.answer).toContain("Closet");
    expect(result.mode).toBe("search");
  });
  it("never treats a write request as an inventory mutation", async () => {
    const result = await askInventory("Delete my jacket", reader);
    expect(result.answer).toMatch(/read.only/i);
    expect(jacket.name).toBe("Winter jacket");
  });
  it("states that there are no matches", async () =>
    expect((await askInventory("toothpaste", reader)).citations).toEqual([]));
  it("rejects invented citations from a provider and falls back", async () => {
    const result = await askInventory("jacket", reader, {
      answer: async () => ({ answer: "You own skis", itemIds: ["fake"] }),
    });
    expect(result.mode).toBe("search");
    expect(result.notice).toBeTruthy();
    expect(result.answer).not.toContain("skis");
  });
  it("gives a provider facts with no write capability", async () => {
    const result = await askInventory("jacket", reader, {
      answer: async (context) => {
        expect(Object.keys(context).sort()).toEqual(["items", "question"]);
        return {
          answer: "Your jacket is in the Closet.",
          itemIds: [jacket.id],
        };
      },
    });
    expect(result.mode).toBe("ai");
    expect(result.citations[0].id).toBe(jacket.id);
  });
  it("falls back if a provider is unavailable", async () =>
    expect(
      (
        await askInventory("jacket", reader, {
          answer: async () => {
            throw new Error("offline");
          },
        })
      ).mode,
    ).toBe("search"));
});
describe("observation reconciliation", () => {
  const observation = {
    user_id: owner,
    item_id: jacket.id,
    source: "camera" as const,
    source_event_id: "frame-123",
    confidence: 0.95,
    observed_at: "2026-09-02T00:00:00Z",
    base_version: 2,
    proposed_patch: { status: "stored" as const },
  };
  it("only proposes a review even for high confidence", () => {
    expect(reconcile(jacket, observation)).toMatchObject({
      decision: "review",
      reason: "confirmation_required",
    });
    expect(jacket.status).toBe("active");
  });
  it("rejects a cross-owner observation", () =>
    expect(() =>
      reconcile(jacket, {
        ...observation,
        user_id: "33333333-3333-4333-8333-333333333333",
      }),
    ).toThrow());
  it("marks stale observations as conflicts", () =>
    expect(
      reconcile(jacket, { ...observation, base_version: 1 }),
    ).toMatchObject({ reason: "version_conflict" }));
  it("does not promote uncertain vision signals", () =>
    expect(
      reconcile(jacket, { ...observation, confidence: 0.4 }),
    ).toMatchObject({ reason: "low_confidence" }));
  it("rejects a negative inferred quantity", () =>
    expect(() =>
      reconcile(jacket, { ...observation, proposed_patch: { quantity: -2 } }),
    ).toThrow());
});
it("bounds model context even when items carry large attributes", async () => {
  const large = Array.from({ length: 50 }, (_, n) => ({
    ...jacket,
    id: `item-${n}`,
    description: "d".repeat(2000),
    attributes: { notes: "x".repeat(7000) },
  }));
  let bytes = 0;
  await askInventory(
    "jacket",
    { search: async () => large },
    {
      answer: async (context) => {
        bytes = JSON.stringify(context).length;
        return { answer: "Found jackets.", itemIds: [context.items[0].id] };
      },
    },
  );
  expect(bytes).toBeLessThan(14000);
});
