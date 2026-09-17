// @vitest-environment jsdom
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { apiRepository } from "../src/lib/browser-api";
import { uploadInventoryPhoto } from "../src/lib/browser-photos";
import { itemInput, type Item } from "../src/lib/inventory";

vi.mock("../src/lib/browser-photos", () => ({ uploadInventoryPhoto: vi.fn() }));
let LiquidDashboard: typeof import("../src/components/liquid-dashboard").LiquidDashboard;
const owner = "11111111-1111-4111-8111-111111111111";
const path = `${owner}/33333333-3333-4333-8333-333333333333.png`;
const camera: Item = {
  ...itemInput.parse({
    name: "Camera",
    attributes: { image_path: "/inventory-assets/camera.png" },
  }),
  id: "22222222-2222-4222-8222-222222222222",
  user_id: owner,
  version: 1,
  location_name: null,
  created_at: "2026-09-16",
  updated_at: "2026-09-16",
};
let records: Item[];
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  ({ LiquidDashboard } = await import("../src/components/liquid-dashboard"));
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  records = [structuredClone(camera)];
  vi.spyOn(apiRepository, "list").mockImplementation(async () => records);
  vi.spyOn(apiRepository, "locations").mockResolvedValue([]);
  vi.spyOn(apiRepository, "update").mockImplementation(
    async (id, version, input) => {
      const saved = {
        ...records.find((row) => row.id === id)!,
        ...input,
        version: version + 1,
      };
      records = records.map((row) => (row.id === id ? saved : row));
      return saved;
    },
  );
  vi.mocked(uploadInventoryPhoto).mockResolvedValue(path);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(uploadInventoryPhoto).mockReset();
});

it("uploads a saved photo and displays it in details and the grid after remounting", async () => {
  const user = userEvent.setup();
  const view = render(<LiquidDashboard />);
  await screen.findByText("Saved inventory ready");
  await user.upload(
    screen.getByLabelText("Upload item photo"),
    new File(["photo"], "camera.png", { type: "image/png" }),
  );
  await screen.findByText("Photo saved to your inventory");
  const image = screen.getByRole("img", { name: "Camera" });
  expect(image.getAttribute("src")).toMatch(/^\/api\/items\/.+\/photo\?/);
  expect(image).not.toHaveAttribute("srcset");
  expect(
    screen.getByRole("button", { name: "View Camera" }).querySelector("img"),
  ).toHaveAttribute("src", image.getAttribute("src"));
  expect(screen.getByText(/JPG, PNG, or WebP · Up to 5 MB/)).toHaveTextContent(
    "Private · Saved to your account",
  );
  const source = image.getAttribute("src");
  view.unmount();
  render(<LiquidDashboard />);
  await screen.findByText("Saved inventory ready");
  expect(screen.getByRole("img", { name: "Camera" })).toHaveAttribute(
    "src",
    source,
  );
});

it.each(["upload", "save"])(
  "reports a failed %s without displaying an unsaved photo",
  async (stage) => {
    if (stage === "upload")
      vi.mocked(uploadInventoryPhoto).mockRejectedValue(
        new Error("Photo upload failed"),
      );
    else
      vi.mocked(apiRepository.update).mockRejectedValue(
        new Error("Version conflict"),
      );
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await screen.findByText("Saved inventory ready");
    const source = screen
      .getByRole("img", { name: "Camera" })
      .getAttribute("src");
    await user.upload(
      screen.getByLabelText("Upload item photo"),
      new File(["photo"], "camera.png", { type: "image/png" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Upload item photo")).not.toBeDisabled(),
    );
    expect(screen.getByRole("img", { name: "Camera" })).toHaveAttribute(
      "src",
      source,
    );
    expect(
      screen.queryByText("Photo saved to your inventory"),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) => /photo|conflict/i.test(alert.textContent ?? "")),
    ).toBe(true);
  },
);
