import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { uploadInventoryPhoto } from "../src/lib/browser-photos";

const owner = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upload: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: { getUser: mocks.getUser },
    storage: { from: mocks.from },
  }),
}));
beforeEach(() => {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: owner } },
    error: null,
  });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ upload: mocks.upload });
});
afterEach(() => vi.resetAllMocks());

it("uploads to a fresh owner-scoped object without publishing or overwriting", async () => {
  const file = new File(["photo"], "personal-camera-name.png", {
    type: "image/png",
  });
  const first = await uploadInventoryPhoto(file, owner);
  const second = await uploadInventoryPhoto(file, owner);
  expect(first).toMatch(new RegExp(`^${owner}/[0-9a-f-]+\\.png$`));
  expect(first).not.toBe(second);
  expect(first).not.toContain(file.name);
  expect(mocks.from).toHaveBeenCalledWith("inventory-photos");
  expect(mocks.upload).toHaveBeenCalledWith(first, file, {
    contentType: "image/png",
    cacheControl: "0",
    upsert: false,
  });
});

it("requires the current session to match the item owner", async () => {
  const file = new File(["photo"], "camera.png", { type: "image/png" });
  await expect(
    uploadInventoryPhoto(file, "22222222-2222-4222-8222-222222222222"),
  ).rejects.toThrow(/sign in/i);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(uploadInventoryPhoto(file, owner)).rejects.toThrow(/sign in/i);
  expect(mocks.upload).not.toHaveBeenCalled();
});

it("rejects invalid files before contacting storage and reports upload failure", async () => {
  await expect(
    uploadInventoryPhoto(
      new File(["text"], "a.txt", { type: "text/plain" }),
      owner,
    ),
  ).rejects.toThrow(/JPG/);
  expect(mocks.getUser).not.toHaveBeenCalled();
  mocks.upload.mockResolvedValue({ error: { message: "Bucket missing" } });
  await expect(
    uploadInventoryPhoto(
      new File(["photo"], "a.jpg", { type: "image/jpeg" }),
      owner,
    ),
  ).rejects.toThrow(/photo storage/i);
});
