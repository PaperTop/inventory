import { expect, it } from "vitest";
import {
  prepareInventoryChanges,
  requestsInventoryChange,
} from "../src/lib/inventory-changes";
import { itemInput, type Item } from "../src/lib/inventory";

const row: Item = {
  ...itemInput.parse({
    name: "Camera",
    description: "Original notes",
    tags: ["photo"],
    attributes: { brand: "Test" },
  }),
  id: "camera",
  user_id: "owner",
  version: 2,
  location_name: "Home",
  created_at: "2026-09-15",
  updated_at: "2026-09-15",
};
const versions = { camera: 2 };
it("keeps repeated packing-list revisions separate from inventory edits", () => {
  const history = [
    { question: "Pack me for camping", answer: "Your packing list." },
    { question: "Add a jacket", answer: "Here is the revised packing list." },
  ];
  expect(requestsInventoryChange("Add a tent too", history)).toBe(false);
  expect(requestsInventoryChange("Add a tent to my inventory", history)).toBe(
    true,
  );
});
it("preserves omitted fields and normalizes edited tags", () => {
  const [change] = prepareInventoryChanges(
    [
      {
        type: "update",
        id: "camera",
        changes: { name: "Travel camera", tags: ["Photo", "CAMPING"] },
      },
    ],
    [row],
    [],
    ["Home"],
    versions,
  );
  expect(change.item).toMatchObject({
    name: "Travel camera",
    tags: ["photo", "camping"],
    description: "Original notes",
    attributes: { brand: "Test" },
    version: 3,
    user_id: "owner",
  });
  expect(row.name).toBe("Camera");
});
it("rejects edits to a version changed while the model was answering", () => {
  expect(() =>
    prepareInventoryChanges(
      [{ type: "update", id: "camera", changes: { name: "Travel camera" } }],
      [row],
      [],
      ["Home"],
      { camera: 1 },
    ),
  ).toThrow(/changed while/);
});
it("places a new item inside an existing local container", () => {
  const drawer: Item = {
    ...row,
    id: "drawer",
    name: "Drawer",
    kind: "container",
    parent_container_id: null,
  };
  const [change] = prepareInventoryChanges(
    [{ type: "create", item: { name: "Lens", location: "Drawer" } }],
    [row, drawer],
    [],
    ["Home"],
    versions,
  );
  expect(change.item).toMatchObject({
    name: "Lens",
    parent_container_id: "drawer",
    location_name: "Home",
  });
});
it.each(["Unknown place", "Camera"])(
  "rejects a location that is not an existing place or container: %s",
  (location) => {
    expect(() =>
      prepareInventoryChanges(
        [{ type: "update", id: "camera", changes: { location } }],
        [row],
        [],
        ["Home"],
        versions,
      ),
    ).toThrow(/missing or ambiguous/);
  },
);
it("rejects a location shared by multiple containers", () => {
  const drawers: Item[] = [1, 2].map((n) => ({
    ...row,
    id: `drawer-${n}`,
    name: "Drawer",
    kind: "container",
  }));
  expect(() =>
    prepareInventoryChanges(
      [{ type: "create", item: { name: "Lens", location: "Drawer" } }],
      [row, ...drawers],
      [],
      ["Home"],
      versions,
    ),
  ).toThrow(/ambiguous/);
});
it("supports consumable stock while rejecting multiple durable items", () => {
  const [change] = prepareInventoryChanges(
    [
      {
        type: "create",
        item: { name: "Batteries", kind: "consumable", quantity: 4 },
      },
    ],
    [row],
    [],
    ["Home"],
    versions,
  );
  expect(change.item.quantity).toBe(4);
  expect(() =>
    prepareInventoryChanges(
      [{ type: "create", item: { name: "Camera", quantity: 4 } }],
      [row],
      [],
      ["Home"],
      versions,
    ),
  ).toThrow(/quantity 1/);
});
