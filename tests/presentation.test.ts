import { describe, expect, it } from "vitest";
import {
  buildInventorySlots,
  duplicateInventoryItem,
  filterInventory,
} from "../src/lib/presentation";
import type { Item } from "../src/lib/inventory";

const item: Item = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "11111111-1111-4111-8111-111111111111",
  name: "Winter jacket",
  kind: "durable",
  description: "Warm insulated coat",
  category: "Clothing",
  quantity: 1,
  unit: "item",
  reorder_threshold: null,
  location_id: null,
  location_name: "Closet",
  tags: ["winter"],
  attributes: { color: "blue" },
  status: "active",
  condition: "good",
  version: 2,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

describe("inventory grid presentation", () => {
  it("fills a short inventory with empty slots", () => {
    const slots = buildInventorySlots([item], 24);

    expect(slots).toHaveLength(24);
    expect(slots[0]).toBe(item);
    expect(slots.slice(1).every((slot) => slot === null)).toBe(true);
  });

  it("never hides inventory that exceeds the minimum grid size", () => {
    const items = Array.from({ length: 26 }, (_, index) => ({
      ...item,
      id: `item-${index}`,
    }));

    expect(buildInventorySlots(items, 24)).toEqual(items);
  });

  it("combines search, kind, location, and recent-first sorting", () => {
    const items: Item[] = [
      item,
      {
        ...item,
        id: "camera",
        name: "Travel camera",
        category: "Electronics",
        location_name: "Studio",
        tags: ["travel"],
        updated_at: "2026-09-12T00:00:00Z",
      },
      {
        ...item,
        id: "charger",
        name: "USB-C charger",
        category: "Electronics",
        location_name: "Backpack",
        tags: ["travel"],
        updated_at: "2026-09-13T00:00:00Z",
      },
    ];

    expect(
      filterInventory(items, {
        query: "travel",
        kind: "durable",
        location: "Backpack",
        sort: "recent",
      }).map((entry) => entry.id),
    ).toEqual(["charger"]);
  });

  it("duplicates an item as a distinct editable local record", () => {
    const duplicate = duplicateInventoryItem(item, "copy-id", "2026-09-14T00:00:00Z");

    expect(duplicate).toMatchObject({
      id: "copy-id",
      name: "Winter jacket copy",
      version: 1,
      created_at: "2026-09-14T00:00:00Z",
      updated_at: "2026-09-14T00:00:00Z",
    });
    expect(duplicate.tags).toEqual(["winter"]);
    expect(duplicate.tags).not.toBe(item.tags);
  });
});
