// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { apiRepository } from "../src/lib/browser-api";
import { itemInput, type Item } from "../src/lib/inventory";
import type { AskResult } from "../src/lib/ask";
import type { DashboardBriefing } from "../src/lib/dashboard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps an in-flight dashboard exchange and its follow-up context across navigation without duplicate sends", async () => {
  const user = userEvent.setup();
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const firstQuestion = "What can I use to take pictures?";
  const firstAnswer = "Your camera is available.";
  const requests: { question: string; history: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_path: string, options: RequestInit) => {
      requests.push(JSON.parse(options.body as string));
      return requests.length === 1
        ? pending
        : Promise.resolve(
            Response.json({
              mode: "ai",
              answer: "Take the camera and tripod together.",
              citations: [],
            } satisfies AskResult),
          );
    }),
  );
  render(<LiquidDashboard />);
  const input = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(input, `${firstQuestion}{Enter}{Enter}`);
  const conversation = screen.getByRole("log", { name: "Jarvis conversation" });
  expect(within(conversation).getByText(firstQuestion)).toBeVisible();
  expect(conversation).toHaveAttribute("aria-busy", "true");
  expect(requests).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Close Jarvis" })).toBeNull();
  expect(screen.getAllByRole("textbox", { name: "Ask Jarvis" })).toHaveLength(
    1,
  );

  await user.click(screen.getByRole("button", { name: "All items" }));
  expect(
    screen.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  expect(screen.queryByRole("textbox", { name: "Ask Jarvis" })).toBeNull();
  await act(async () =>
    finish(
      Response.json({
        mode: "ai",
        answer: firstAnswer,
        citations: [],
      } satisfies AskResult),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
  expect(await within(conversation).findByText(firstAnswer)).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Ask Jarvis" })).toHaveFocus();
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "What else should I take?{Enter}",
  );
  expect(
    await within(conversation).findByText(
      "Take the camera and tripod together.",
    ),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].history).toEqual([
    { question: firstQuestion, answer: firstAnswer },
  ]);
  expect(screen.queryByRole("button", { name: "Close Jarvis" })).toBeNull();
});

it("shows saved partial success and failure inline and opens only the item actually saved", async () => {
  const user = userEvent.setup();
  const briefing: DashboardBriefing = {
    asOf: "2026-10-12T12:00:00.000Z",
    lastVisitedAt: null,
    activityHeading: "Recent inventory activity",
    summary: "No recent inventory activity has been recorded yet.",
    activityCount: 0,
    hasMore: false,
    groups: [],
    suggestion: null,
  };
  const tent: Item = {
    ...itemInput.parse({ name: "Tent", category: "Camping" }),
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    location_name: null,
    created_at: briefing.asOf,
    updated_at: briefing.asOf,
  };
  const create = vi
    .spyOn(apiRepository, "create")
    .mockResolvedValueOnce(tent)
    .mockRejectedValueOnce(new Error("Storage unavailable"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/dashboard") return Response.json(briefing);
      if (path === "/api/dashboard/visit")
        return Response.json({ visited: true });
      if (path === "/api/ask")
        return Response.json({
          mode: "ai",
          answer: "Everything was saved.",
          citations: [],
          changes: [
            { type: "create", item: { name: "Tent", category: "Camping" } },
            { type: "create", item: { name: "Torch", category: "Camping" } },
          ],
        } satisfies AskResult);
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  render(<LiquidDashboard savedInventory={{ items: [], locations: [] }} />);
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "Add a tent and torch to my inventory{Enter}",
  );
  const conversation = screen.getByRole("log", { name: "Jarvis conversation" });
  expect(
    await within(conversation).findByText(
      /Added Tent.*remaining changes were not applied/s,
    ),
  ).toBeVisible();
  expect(within(conversation).getByText(/could not be saved/)).toBeVisible();
  expect(within(conversation).queryByText("Everything was saved.")).toBeNull();
  expect(
    within(conversation).queryByRole("button", { name: "Open Torch" }),
  ).toBeNull();
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls.every(([, actor]) => actor === "jarvis")).toBe(true);
  await user.click(
    within(conversation).getByRole("button", { name: "Open Tent" }),
  );
  expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue(
    "Tent",
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "All items" }));
  expect(screen.getByRole("button", { name: "View Tent" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "View Torch" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Dashboard" }));
  expect(
    within(conversation).getByText(/remaining changes were not applied/),
  ).toBeVisible();
  expect(create).toHaveBeenCalledTimes(2);
});
