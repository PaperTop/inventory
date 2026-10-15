// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LiquidDashboard } from "../src/components/liquid-dashboard";

afterEach(cleanup);

function expectNoMovementControls() {
  expect(screen.queryByRole("button", { name: /^Drag / })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /^Move or reorder / }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: /^(Move up|Move down|Move to…|Reorder)/,
    }),
  ).toBeNull();
  expect(document.querySelector('[draggable="true"]')).toBeNull();
}

it("removes universal movement and manual ordering from navigation, Space/Room views, grid and list while retaining item location editing", async () => {
  const user = userEvent.setup();
  render(<LiquidDashboard />);
  expectNoMovementControls();
  await user.click(screen.getByRole("button", { name: "Spaces" }));
  expectNoMovementControls();
  await user.click(screen.getByRole("button", { name: "Open Home" }));
  expect(screen.getAllByRole("button", { name: "Add room" })[0]).toBeVisible();
  expectNoMovementControls();
  await user.click(screen.getByRole("button", { name: "All items" }));
  expectNoMovementControls();
  await user.click(screen.getByRole("combobox", { name: "Sort" }));
  expect(
    screen.queryByRole("option", { name: /Custom order|Manual order/ }),
  ).toBeNull();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "List view" }));
  expectNoMovementControls();
  await user.click(screen.getByRole("button", { name: "Grid view" }));
  await user.click(screen.getByRole("button", { name: "View Contact lenses" }));
  expect(
    screen.getByRole("combobox", { name: "Item location" }),
  ).toHaveTextContent("Home → Bedroom → Cabinet → Drawer");
  expectNoMovementControls();
});
