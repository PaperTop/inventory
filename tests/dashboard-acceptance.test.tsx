// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import type { DashboardBriefing } from "../src/lib/dashboard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps saved loading and errors truthful, then acknowledges only the rendered briefing", async () => {
  let finishFirstLoad!: (response: Response) => void;
  const firstLoad = new Promise<Response>((resolve) => {
    finishFirstLoad = resolve;
  });
  const briefing: DashboardBriefing = {
    asOf: "2026-09-25T12:00:00.000Z",
    lastVisitedAt: null,
    activityHeading: "Recent inventory activity",
    summary: "No recent inventory activity has been recorded yet.",
    activityCount: 0,
    hasMore: false,
    groups: [],
    suggestion: null,
  };
  let loads = 0;
  const fetchMock = vi.fn((path: string, options?: RequestInit) => {
    if (path === "/api/dashboard" && (!options || options.method === "GET")) {
      loads++;
      return loads === 1 ? firstLoad : Promise.resolve(Response.json(briefing));
    }
    if (path === "/api/dashboard/visit" && options?.method === "POST")
      return Promise.resolve(Response.json({ visited: true }));
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <LiquidDashboard
      savedInventory={{ items: [], locations: [] }}
      accountEmail="owner@example.com"
    />,
  );

  expect(
    screen.getByRole("status", { name: "Loading dashboard" }),
  ).toBeVisible();
  expect(screen.queryByText(/sample inventory/i)).toBeNull();
  expect(fetchMock).not.toHaveBeenCalledWith(
    "/api/dashboard/visit",
    expect.anything(),
  );

  finishFirstLoad(
    Response.json({ error: "Connection interrupted." }, { status: 503 }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Connection interrupted.",
  );
  expect(screen.getByRole("textbox", { name: "Ask Jarvis" })).toBeEnabled();
  expect(fetchMock).not.toHaveBeenCalledWith(
    "/api/dashboard/visit",
    expect.anything(),
  );

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(briefing.summary)).toBeVisible();
  expect(screen.getByText("No recent activity yet")).toBeVisible();
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/visit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ asOf: briefing.asOf }),
      }),
    ),
  );
});
