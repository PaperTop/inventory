// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { apiRepository } from "../src/lib/browser-api";
import { itemInput, type Location } from "../src/lib/inventory";
import { visualItem } from "../src/components/use-inventory-store";

const owner = "11111111-1111-4111-8111-111111111111";
const home: Location = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: owner,
  name: "Home",
};
const room: Location = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: owner,
  name: "Bedroom",
  parent_location_id: home.id,
};
const box = visualItem({
  ...itemInput.parse({ name: "Box", kind: "container", location_id: room.id }),
  id: "44444444-4444-4444-8444-444444444444",
  user_id: owner,
  version: 1,
  created_at: "2026-10-14",
  updated_at: "2026-10-14",
  location_name: "Bedroom",
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount(items = [] as (typeof box)[], locations = [home, room]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/dashboard")
        return Response.json({
          asOf: "2026-10-14",
          lastVisitedAt: null,
          activityHeading: "Recent activity",
          summary: "No activity.",
          activityCount: 0,
          hasMore: false,
          groups: [],
          suggestion: null,
        });
      if (path === "/api/dashboard/visit")
        return Response.json({ visited: true });
      throw new Error(`Unexpected request ${path}`);
    }),
  );
  render(<LiquidDashboard savedInventory={{ items, locations }} />);
  return userEvent.setup();
}
it.each(["space", "room", "container"])(
  "empty %s offers a contextual unsaved Add with its full destination and no phantom on Cancel",
  async (type) => {
    const create = vi.spyOn(apiRepository, "create");
    const user = mount(type === "container" ? [box] : []);
    const nav = within(
      screen.getByRole("navigation", { name: "Inventory locations" }),
    );
    await user.click(nav.getByRole("button", { name: "Home" }));
    if (type !== "space")
      await user.click(nav.getByRole("button", { name: "Bedroom" }));
    if (type === "container")
      await user.click(screen.getByRole("button", { name: "Open Box" }));
    const region = within(
      screen.getByRole("region", {
        name: type === "container" ? "Box contents" : "Inventory items",
      }),
    );
    expect(region.getByText(/No items directly in .* yet/)).toBeVisible();
    expect(region.getAllByRole("button", { name: "Add item" })).toHaveLength(1);
    await user.click(region.getByRole("button", { name: "Add item" }));
    const draft = within(screen.getByRole("dialog", { name: "Add item" }));
    const path =
      type === "space"
        ? "Home"
        : type === "room"
          ? "Home → Bedroom"
          : "Home → Bedroom → Box";
    expect(draft.getByText(new RegExp(`Destination: ${path}`))).toBeVisible();
    expect(create).not.toHaveBeenCalled();
    await user.click(draft.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  },
);
it("global Add item requires a destination and keeps the invalid draft without a write", async () => {
  const create = vi.spyOn(apiRepository, "create");
  const user = mount();
  await user.click(screen.getByRole("button", { name: "All items" }));
  await user.click(screen.getByRole("button", { name: "Add item" }));
  const draft = within(screen.getByRole("dialog", { name: "Add item" }));
  expect(
    draft.getByText(/Choose a space, room, or container before adding/),
  ).toBeVisible();
  await user.type(draft.getByRole("textbox", { name: "Name" }), "Camera");
  await user.click(draft.getByRole("button", { name: "Add item" }));
  expect(await draft.findByRole("alert")).toHaveTextContent(/Choose/);
  expect(create).not.toHaveBeenCalled();
  expect(draft.getByRole("textbox", { name: "Name" })).toHaveValue("Camera");
});
