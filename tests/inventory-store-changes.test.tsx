// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  useInventoryStore,
  visualItem,
} from "../src/components/use-inventory-store";
import { apiRepository } from "../src/lib/browser-api";
import { itemInput, type Item } from "../src/lib/inventory";

const row: Item = {
  ...itemInput.parse({ name: "Camera", description: "Keep these notes" }),
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "owner",
  version: 2,
  location_name: null,
  created_at: "2026-09-15",
  updated_at: "2026-09-15",
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("waits for the saved API and preserves omitted fields when applying a chat edit", async () => {
  vi.spyOn(apiRepository, "update").mockImplementation(
    async (id, version, input) => {
      expect(id).toBe(row.id);
      expect(version).toBe(2);
      expect(input.description).toBe("Keep these notes");
      return { ...row, ...input, version: 3 };
    },
  );
  const { result } = renderHook(() =>
    useInventoryStore([visualItem(row)], [], true),
  );
  await act(async () => {
    const outcome = await result.current.applyChanges(
      [{ type: "update", id: row.id, changes: { name: "Travel camera" } }],
      { [row.id]: 2 },
      [],
    );
    expect(outcome.summary).toBe("Updated Travel camera.");
    expect(outcome.items[0].version).toBe(3);
  });
  expect(result.current.items[0].name).toBe("Travel camera");
});
it("rolls back a failed saved edit and does not report success", async () => {
  vi.spyOn(apiRepository, "update").mockRejectedValue(
    new Error("Version conflict"),
  );
  const { result } = renderHook(() =>
    useInventoryStore([visualItem(row)], [], true),
  );
  await act(async () => {
    const outcome = await result.current.applyChanges(
      [{ type: "update", id: row.id, changes: { name: "Travel camera" } }],
      { [row.id]: 2 },
      [],
    );
    expect(outcome.items).toEqual([]);
    expect(outcome.summary).toBe("No items were changed.");
    expect(outcome.error).toBeTruthy();
  });
  expect(result.current.items[0].name).toBe("Camera");
  expect(result.current.error).toContain("Version conflict");
});
it("reports completed creates when a later saved create fails, without retrying", async () => {
  const create = vi
    .spyOn(apiRepository, "create")
    .mockResolvedValueOnce({
      ...row,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Tent",
      version: 1,
    })
    .mockRejectedValueOnce(new Error("Storage unavailable"));
  const { result } = renderHook(() =>
    useInventoryStore([visualItem(row)], [], true),
  );
  await act(async () => {
    const outcome = await result.current.applyChanges(
      [
        { type: "create", item: { name: "Tent" } },
        { type: "create", item: { name: "Torch" } },
      ],
      {},
      [],
    );
    expect(outcome.items.map((item) => item.name)).toEqual(["Tent"]);
    expect(outcome.summary).toMatch(/remaining changes were not applied/);
  });
  expect(result.current.items.map((item) => item.name)).toContain("Tent");
  expect(result.current.items.map((item) => item.name)).not.toContain("Torch");
  expect(create).toHaveBeenCalledTimes(2);
});

it("restores a saved private photo from an item loaded in a fresh session", () => {
  const owner = "22222222-2222-4222-8222-222222222222";
  const path = `${owner}/33333333-3333-4333-8333-333333333333.png`;
  const restored = visualItem({
    ...row,
    user_id: owner,
    attributes: { image_path: path },
  });
  expect(restored.image).toBe(
    `/api/items/${row.id}/photo?image=${encodeURIComponent(path)}`,
  );
  expect(visualItem({ ...row, attributes: { image_path: path } }).image).toBe(
    "/inventory-assets/item.svg",
  );
});
