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
import { InventoryDashboard } from "../src/components/inventory-dashboard";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { visualItem } from "../src/components/use-inventory-store";
import { itemInput, type Item } from "../src/lib/inventory";
import type { DashboardBriefing } from "../src/lib/dashboard";
import { apiRepository } from "../src/lib/browser-api";

const camera = visualItem({
  ...itemInput.parse({
    name: "Camera",
    category: "Electronics",
    attributes: { image_path: "/inventory-assets/camera.png" },
  }),
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  location_name: "Bedroom",
  created_at: "2026-09-19T09:00:00.000Z",
  updated_at: "2026-09-19T09:30:00.000Z",
} satisfies Item);

const briefing: DashboardBriefing = {
  asOf: "2026-09-19T10:00:00.000Z",
  lastVisitedAt: "2026-09-19T08:00:00.000Z",
  activityHeading: "Since your last visit",
  summary: "Since your last visit, 2 inventory changes were recorded.",
  activityCount: 2,
  hasMore: false,
  groups: [
    {
      room: { id: "room-1", name: "Bedroom" },
      activities: [
        {
          id: "activity-1",
          itemId: camera.id,
          itemName: camera.name,
          kind: "updated",
          actor: "jarvis",
          occurredAt: "2026-09-19T09:30:00.000Z",
          imagePath: "/inventory-assets/camera.png",
          detail: "Updated tags",
        },
      ],
    },
    {
      room: { id: null, name: "Unassigned" },
      activities: [
        {
          id: "activity-2",
          itemId: null,
          itemName: "Old cable",
          kind: "deleted",
          actor: "user",
          occurredAt: "2026-09-19T09:00:00.000Z",
          imagePath: null,
          detail: "Deleted",
        },
      ],
    },
  ],
  suggestion: {
    id: "suggestion-1",
    text: "Jarvis noticed your electronics are stored in 2 spaces.",
    prompt: "Review my electronics and make a read-only plan.",
    itemIds: [camera.id],
    roomNames: ["Bedroom", "Office"],
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders truthful grouped activity and starts Jarvis prompts", async () => {
  const user = userEvent.setup();
  const onAsk = vi.fn();
  const onSelectItem = vi.fn();
  render(
    <InventoryDashboard
      briefing={briefing}
      items={[camera]}
      accountEmail="jaden.huang@example.com"
      onAsk={onAsk}
      onSelectItem={onSelectItem}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Your inventory, in brief." }),
  ).toBeVisible();
  expect(screen.getByText("Welcome back, Jaden")).toBeVisible();
  expect(screen.getByText(briefing.summary)).toBeVisible();
  expect(screen.getByText("Updated tags Camera")).toBeVisible();
  expect(screen.getByText("via Jarvis")).toBeVisible();
  expect(screen.getByText("Deleted Old cable")).toBeVisible();
  expect(screen.getByText("by you")).toBeVisible();

  await user.click(screen.getByRole("button", { name: /open camera/i }));
  expect(onSelectItem).toHaveBeenCalledWith(camera.id);
  await user.click(screen.getByRole("button", { name: /plan together/i }));
  expect(onAsk).toHaveBeenCalledWith(briefing.suggestion!.prompt);

  const composer = screen.getByRole("form", { name: "Ask Jarvis" });
  await user.type(within(composer).getByRole("textbox"), "Where is my lens?");
  await user.click(within(composer).getByRole("button", { name: /send/i }));
  expect(onAsk).toHaveBeenCalledWith("Where is my lens?");
});

it("shows distinct loading, error, and empty states", () => {
  const props = { items: [], onAsk: vi.fn(), onSelectItem: vi.fn() };
  const view = render(
    <InventoryDashboard briefing={null} loading {...props} />,
  );
  expect(
    screen.getByRole("status", { name: "Loading dashboard" }),
  ).toBeVisible();

  view.rerender(
    <InventoryDashboard
      briefing={null}
      error="Connection interrupted."
      {...props}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Connection interrupted.",
  );

  view.rerender(
    <InventoryDashboard
      briefing={{ ...briefing, groups: [], activityCount: 0, suggestion: null }}
      {...props}
    />,
  );
  expect(screen.getByText("No recent activity yet")).toBeVisible();
});

it("keeps the Jarvis composer keyboard-usable while activity is loading or unavailable", async () => {
  const user = userEvent.setup();
  const onAsk = vi.fn();
  const props = { items: [], onAsk, onSelectItem: vi.fn() };
  const view = render(
    <InventoryDashboard briefing={null} loading {...props} />,
  );
  const prompt = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(prompt, "Where is my backpack?{Enter}");
  expect(onAsk).toHaveBeenCalledWith("Where is my backpack?");

  view.rerender(
    <InventoryDashboard briefing={null} error="Offline" {...props} />,
  );
  await user.type(prompt, "Help me plan my shelves{Enter}");
  expect(onAsk).toHaveBeenCalledWith("Help me plan my shelves");
  expect(prompt).toHaveValue("");
});

it("refreshes saved dashboard activity after an item edit finishes", async () => {
  const user = userEvent.setup();
  let reads = 0;
  const fetchMock = vi.fn(async (path: string) => {
    if (path === "/api/dashboard") {
      reads++;
      return new Response(
        JSON.stringify({
          ...briefing,
          asOf: `2026-09-19T10:0${reads}:00.000Z`,
          summary: reads === 1 ? "Before the edit." : "After the edit.",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(apiRepository, "update").mockResolvedValue({
    ...camera,
    quantity: 2,
    version: 2,
  });

  render(
    <LiquidDashboard savedInventory={{ items: [camera], locations: [] }} />,
  );
  expect(await screen.findByText("Before the edit.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Open Camera/ }));
  await user.click(screen.getByRole("button", { name: "Increase quantity" }));

  expect(await screen.findByText("After the edit.")).toBeVisible();
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([path]) => path === "/api/dashboard"),
    ).toHaveLength(2),
  );
});
