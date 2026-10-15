// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { apiRepository } from "../src/lib/browser-api";
import { type Location } from "../src/lib/inventory";

const owner = "11111111-1111-4111-8111-111111111111";
const home: Location = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: owner,
  name: "Home",
};
const cabin: Location = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: owner,
  name: "Cabin",
};
const bedroom: Location = {
  id: "44444444-4444-4444-8444-444444444444",
  user_id: owner,
  name: "Bedroom",
  parent_location_id: cabin.id,
};
const locations = [home, cabin, bedroom];

function setup() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/dashboard")
        return Response.json({
          asOf: "2026-10-13T12:00:00Z",
          lastVisitedAt: null,
          activityHeading: "Recent inventory activity",
          summary: "No activity yet.",
          activityCount: 0,
          hasMore: false,
          groups: [],
          suggestion: null,
        });
      if (path === "/api/dashboard/visit")
        return Response.json({ visited: true });
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  render(<LiquidDashboard savedInventory={{ items: [], locations }} />);
  return userEvent.setup();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["space", "room"])(
  "keeps a %s draft unwritten through cancel and invalid input, then retries one pending commit with the same identity",
  async (type) => {
    let finish!: (row: Location) => void;
    const create = vi
      .spyOn(apiRepository, "createLocation")
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const user = setup();
    if (type === "space")
      await user.click(screen.getByRole("button", { name: "Spaces" }));
    else
      await user.click(
        within(
          screen.getByRole("navigation", { name: "Inventory locations" }),
        ).getByRole("button", { name: "Home" }),
      );
    const opener = screen.getAllByRole("button", { name: `Add ${type}` })[0];
    await user.click(opener);
    let draft = screen.getByRole("dialog", { name: `Add ${type}` });
    expect(create).not.toHaveBeenCalled();
    await user.click(within(draft).getByRole("button", { name: /Cancel/ }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    await user.click(opener);
    draft = screen.getByRole("dialog", { name: `Add ${type}` });
    await user.type(
      within(draft).getByRole("textbox", {
        name: type === "room" ? "Room name" : "Place name",
      }),
      "   ",
    );
    await user.click(
      within(draft).getByRole("button", { name: `Add ${type}` }),
    );
    expect(within(draft).getByRole("alert")).toHaveTextContent(
      /name is required/i,
    );
    expect(create).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
    await user.click(opener);
    draft = screen.getByRole("dialog", { name: `Add ${type}` });
    const name = type === "room" ? "Bedroom" : "Workshop";
    const field = within(draft).getByRole("textbox", {
      name: type === "room" ? "Room name" : "Place name",
    });
    await user.type(field, name);
    await user.click(
      within(draft).getByRole("button", { name: `Add ${type}` }),
    );
    expect(await within(draft).findByRole("alert")).toHaveTextContent(
      "Connection interrupted",
    );
    expect(field).toHaveValue(name);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]).toEqual([
      name,
      type === "room" ? home.id : null,
      expect.any(String),
    ]);
    const requestId = create.mock.calls[0][2];
    await user.dblClick(
      within(draft).getByRole("button", { name: `Add ${type}` }),
    );
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][2]).toBe(requestId);
    expect(
      within(draft).getByRole("button", { name: /Cancel/ }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(draft).toBeVisible();
    await act(async () =>
      finish({
        id: requestId!,
        user_id: owner,
        name,
        parent_location_id: type === "room" ? home.id : null,
        version: 1,
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(create).toHaveBeenCalledTimes(2);
    if (type === "room")
      expect(
        within(
          screen
            .getByRole("textbox", { name: "Search items" })
            .closest("section")!,
        ).queryByRole("button", { name: "Add room" }),
      ).toBeNull();
  },
);
