// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  useInventoryStore,
  visualItem,
} from "../src/components/use-inventory-store";
import { apiRepository } from "../src/lib/browser-api";
import { uploadInventoryPhoto } from "../src/lib/browser-photos";
import { itemInput, type Item } from "../src/lib/inventory";

vi.mock("../src/lib/browser-photos", () => ({ uploadInventoryPhoto: vi.fn() }));
const owner = "11111111-1111-4111-8111-111111111111";
const path = `${owner}/33333333-3333-4333-8333-333333333333.png`;
const row: Item = {
  ...itemInput.parse({
    name: "Camera",
    description: "Keep these notes",
    attributes: { color: "black" },
  }),
  id: "22222222-2222-4222-8222-222222222222",
  user_id: owner,
  version: 2,
  location_name: null,
  created_at: "2026-09-16",
  updated_at: "2026-09-16",
};
const file = new File(["photo"], "camera.png", { type: "image/png" });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(uploadInventoryPhoto).mockReset();
});

it("saves a photo reference with the item version and restores it after a fresh load", async () => {
  vi.mocked(uploadInventoryPhoto).mockResolvedValue(path);
  let saved = row;
  vi.spyOn(apiRepository, "update").mockImplementation(
    async (id, version, input) => {
      expect(id).toBe(row.id);
      expect(version).toBe(row.version);
      expect(input.description).toBe(row.description);
      expect(input.attributes).toEqual({ color: "black", image_path: path });
      saved = { ...row, ...input, version: version + 1 };
      return saved;
    },
  );
  const hook = renderHook(() => useInventoryStore([visualItem(row)], [], true));
  await act(async () => {
    expect(await hook.result.current.savePhoto(row.id, file)).toBeTruthy();
  });
  expect(uploadInventoryPhoto).toHaveBeenCalledWith(file, owner);
  expect(hook.result.current.items[0].image).toContain(
    `/api/items/${row.id}/photo?`,
  );
  const source = hook.result.current.items[0].image;
  hook.unmount();
  const fresh = renderHook(() =>
    useInventoryStore([visualItem(saved)], [], true),
  );
  expect(fresh.result.current.items[0].image).toBe(source);
  expect(fresh.result.current.items[0].version).toBe(3);
});

it.each(["upload", "save"])(
  "keeps the previous photo when %s fails",
  async (stage) => {
    vi.mocked(uploadInventoryPhoto).mockImplementation(async () => {
      if (stage === "upload") throw new Error("Photo upload failed");
      return path;
    });
    const update = vi
      .spyOn(apiRepository, "update")
      .mockRejectedValue(new Error("Version conflict"));
    const previous = visualItem({
      ...row,
      attributes: { image_path: "/inventory-assets/camera.png" },
    });
    const { result } = renderHook(() =>
      useInventoryStore([previous], [], true),
    );
    await act(async () => {
      expect(await result.current.savePhoto(row.id, file)).toBeUndefined();
    });
    expect(result.current.items[0].image).toBe(previous.image);
    expect(result.current.items[0].version).toBe(row.version);
    expect(result.current.error).toContain(
      stage === "upload" ? "Photo upload failed" : "Version conflict",
    );
    if (stage === "upload") expect(update).not.toHaveBeenCalled();
  },
);

it("serializes photo saves with ordinary edits and uses the latest confirmed version", async () => {
  vi.mocked(uploadInventoryPhoto).mockResolvedValue(path);
  let saved = row;
  const update = vi
    .spyOn(apiRepository, "update")
    .mockImplementation(async (_id, version, input) => {
      expect(version).toBe(saved.version);
      saved = { ...saved, ...input, version: version + 1 };
      return saved;
    });
  const { result } = renderHook(() =>
    useInventoryStore([visualItem(row)], [], true),
  );
  await act(async () => {
    await Promise.all([
      result.current.patch(row.id, { name: "Travel camera" }),
      result.current.savePhoto(row.id, file),
    ]);
  });
  expect(update).toHaveBeenCalledTimes(2);
  expect(saved.name).toBe("Travel camera");
  expect(saved.version).toBe(4);
  expect(saved.attributes.image_path).toBe(path);
});

it("loads a replacement from another session when saved inventory is refreshed", async () => {
  vi.spyOn(apiRepository, "list").mockResolvedValue([
    { ...row, version: 3, attributes: { image_path: path } },
  ]);
  const { result } = renderHook(() =>
    useInventoryStore([visualItem(row)], [], true),
  );
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.items[0].image).toContain(encodeURIComponent(path));
});

it("does not upload photos from sample mode or for a deleted item", async () => {
  const { result } = renderHook(() =>
    useInventoryStore([visualItem(row)], [], false),
  );
  await act(async () => {
    expect(await result.current.savePhoto(row.id, file)).toBeUndefined();
  });
  const saved = renderHook(() => useInventoryStore([], [], true));
  await act(async () => {
    expect(await saved.result.current.savePhoto(row.id, file)).toBeUndefined();
  });
  expect(uploadInventoryPhoto).not.toHaveBeenCalled();
});

it("preserves edits queued during an upload as each response completes", async () => {
  let finishUpload!: (path: string) => void;
  vi.mocked(uploadInventoryPhoto).mockReturnValue(
    new Promise((resolve) => {
      finishUpload = resolve;
    }),
  );
  const stock = { ...row, kind: "consumable" as const, quantity: 1 };
  let saved = stock;
  let finishFirstEdit!: () => void;
  vi.spyOn(apiRepository, "update").mockImplementation(
    async (_id, version, input) => {
      if (input.quantity === 2)
        await new Promise<void>((resolve) => {
          finishFirstEdit = resolve;
        });
      expect(version).toBe(saved.version);
      saved = { ...saved, ...input, kind: "consumable", version: version + 1 };
      return saved;
    },
  );
  const { result } = renderHook(() =>
    useInventoryStore([visualItem(stock)], [], true),
  );
  let photo!: ReturnType<typeof result.current.savePhoto>;
  let first!: ReturnType<typeof result.current.patch>;
  let second!: ReturnType<typeof result.current.patch>;
  await act(async () => {
    photo = result.current.savePhoto(row.id, file);
    await Promise.resolve();
  });
  act(() => {
    first = result.current.patch(row.id, {
      quantity: result.current.items[0].quantity + 1,
    });
  });
  await act(async () => {
    finishUpload(path);
    await photo;
  });
  expect(result.current.items[0].quantity).toBe(2);
  act(() => {
    second = result.current.patch(row.id, {
      quantity: result.current.items[0].quantity + 1,
    });
  });
  expect(result.current.items[0].quantity).toBe(3);
  await act(async () => {
    finishFirstEdit();
    await first;
    await second;
  });
  expect(saved.quantity).toBe(3);
  expect(saved.attributes.image_path).toBe(path);
  expect(result.current.items[0].quantity).toBe(3);
});
