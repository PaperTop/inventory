// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { InventoryDashboard } from "../src/components/inventory-dashboard";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { JarvisChat } from "../src/components/jarvis-chat";
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
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({ mode: "ai", answer: "Your answer", citations: [] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const props = {
    items: [],
    onAsk: vi.fn(),
    onSelectItem: vi.fn(),
    conversation: () => (
      <JarvisChat
        items={[]}
        saved={false}
        onSelect={() => {}}
        onApplyChanges={async () => ({ items: [], summary: "" })}
      />
    ),
  };
  const view = render(
    <InventoryDashboard briefing={null} loading {...props} />,
  );
  const prompt = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(prompt, "Where is my backpack?{Enter}");
  expect(await screen.findByText("Your answer")).toBeVisible();
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
    question: "Where is my backpack?",
  });

  view.rerender(
    <InventoryDashboard briefing={null} error="Offline" {...props} />,
  );
  await user.type(prompt, "Help me plan my shelves{Enter}");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toMatchObject({
    question: "Help me plan my shelves",
  });
  expect(prompt).toHaveValue("");
});

it("refreshes saved dashboard activity after an item edit finishes", async () => {
  const user = userEvent.setup();
  const editableCamera = { ...camera, kind: "consumable" as const };
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
  let finishUpdate!: (item: Item) => void;
  const savedUpdate = new Promise<Item>((resolve) => {
    finishUpdate = resolve;
  });
  const update = vi.spyOn(apiRepository, "update").mockReturnValue(savedUpdate);
  const updatedCamera = {
    ...editableCamera,
    quantity: 2,
    version: 2,
  };

  render(
    <LiquidDashboard
      savedInventory={{ items: [editableCamera], locations: [] }}
    />,
  );
  expect(await screen.findByText("Before the edit.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Open Camera/ }));
  await user.click(screen.getByRole("button", { name: "Increase quantity" }));
  await waitFor(() => expect(update).toHaveBeenCalledOnce());
  expect(screen.getByText("Before the edit.")).toBeVisible();
  await act(async () => {
    finishUpdate(updatedCamera);
    await savedUpdate;
  });
  expect(await screen.findByText("After the edit.")).toBeVisible();
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([path]) => path === "/api/dashboard"),
    ).toHaveLength(2),
  );
});
