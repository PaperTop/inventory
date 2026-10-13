// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { apiRepository } from "../src/lib/browser-api";
import { itemInput, type Item, type Location } from "../src/lib/inventory";
import type { DashboardBriefing } from "../src/lib/dashboard";

const owner = "11111111-1111-4111-8111-111111111111";
const rooms: Location[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: owner,
    name: "Office",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: owner,
    name: "Garage",
  },
];
const date = "2026-10-12T12:00:00.000Z";
const cabinet: Item = {
  ...itemInput.parse({
    name: "Cabinet",
    kind: "container",
    location_id: rooms[0].id,
  }),
  id: "44444444-4444-4444-8444-444444444444",
  user_id: owner,
  location_name: rooms[0].name,
  version: 1,
  created_at: date,
  updated_at: date,
};

function mockBriefing() {
  const briefing: DashboardBriefing = {
    asOf: date,
    lastVisitedAt: null,
    activityHeading: "Recent inventory activity",
    summary: "No recent activity has been recorded yet.",
    activityCount: 0,
    hasMore: false,
    groups: [],
    suggestion: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/dashboard") return Response.json(briefing);
      if (path === "/api/dashboard/visit")
        return Response.json({ visited: true });
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([false, true])(
  "creates and renames a saved container with the current placement (nested: %s)",
  async (nested) => {
    mockBriefing();
    const user = userEvent.setup();
    const targetRoom = nested ? rooms[0] : rooms[1];
    const createdId = "55555555-5555-4555-8555-555555555555";
    let saved!: Item;
    const create = vi
      .spyOn(apiRepository, "create")
      .mockImplementation(async (input) => {
        saved = {
          ...input,
          id: createdId,
          user_id: owner,
          location_name: targetRoom.name,
          version: 1,
          created_at: date,
          updated_at: date,
        };
        return saved;
      });
    const update = vi
      .spyOn(apiRepository, "update")
      .mockImplementation(async (_id, _version, input) => {
        saved = { ...saved, ...input, version: 2 };
        return saved;
      });
    render(
      <LiquidDashboard
        savedInventory={{ items: [cabinet], locations: rooms }}
      />,
    );
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Inventory locations" }),
      ).getByRole("button", { name: targetRoom.name }),
    );
    if (nested)
      await user.click(screen.getByRole("button", { name: "Open Cabinet" }));
    const library = screen
      .getByRole("textbox", { name: "Search items" })
      .closest("section")!;
    const add = within(library).getAllByRole("button", {
      name: "Add container",
    })[0];
    expect(add).toBeVisible();
    expect(
      screen.getByRole("button", { name: "More filters" }),
    ).toHaveAttribute("aria-expanded", "false");
    await user.click(add);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New container",
        kind: "container",
        location_id: nested ? null : targetRoom.id,
        parent_container_id: nested ? cabinet.id : null,
      }),
      undefined,
    );
    const name = await screen.findByRole("textbox", { name: "Item name" });
    await user.clear(name);
    await user.type(name, "Archive box");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        createdId,
        1,
        expect.objectContaining({
          name: "Archive box",
          kind: "container",
          location_id: nested ? null : targetRoom.id,
          parent_container_id: nested ? cabinet.id : null,
        }),
        undefined,
      ),
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Close item details" }),
    );
    await user.click(screen.getByRole("button", { name: "Open Archive box" }));
    expect(
      screen.getByRole("region", { name: "Archive box contents" }),
    ).toBeVisible();
    const breadcrumb = screen.getByRole("navigation", {
      name: "Inventory breadcrumb",
    });
    expect(breadcrumb).toHaveTextContent(targetRoom.name);
    if (nested) expect(breadcrumb).toHaveTextContent("CabinetArchive box");
    expect(create).toHaveBeenCalledOnce();
  },
);

it("offers the space prerequisite instead of creating an unplaced root container when no saved spaces exist", async () => {
  mockBriefing();
  const user = userEvent.setup();
  const create = vi.spyOn(apiRepository, "create");
  render(<LiquidDashboard savedInventory={{ items: [], locations: [] }} />);
  await user.click(screen.getByRole("button", { name: "All items" }));
  expect(screen.queryByRole("button", { name: "Add container" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Spaces" }));
  for (const action of screen.getAllByRole("button", {
    name: "Add space",
  }))
    expect(action).toBeVisible();
  expect(create).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("complementary", { name: "Item details" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Add place" })).toBeVisible();
});

it("reports a failed saved create without opening or displaying a phantom container", async () => {
  mockBriefing();
  const user = userEvent.setup();
  const create = vi
    .spyOn(apiRepository, "create")
    .mockRejectedValue(new Error("Database unavailable"));
  render(<LiquidDashboard savedInventory={{ items: [], locations: rooms }} />);
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Inventory locations" }),
    ).getByRole("button", { name: "Garage" }),
  );
  await user.click(screen.getByRole("button", { name: "Add container" }));
  const feedback = await screen.findByRole("status");
  expect(feedback).toHaveTextContent("Database unavailable");
  expect(feedback).toHaveTextContent(/not confirmed/i);
  expect(create).toHaveBeenCalledOnce();
  expect(
    screen.queryByRole("button", { name: "Open New container" }),
  ).toBeNull();
  expect(
    screen.queryByRole("complementary", { name: "Item details" }),
  ).toBeNull();
});
