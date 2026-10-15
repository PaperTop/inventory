// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JarvisChat } from "../src/components/jarvis-chat";
import { JarvisInventoryResults } from "../src/components/jarvis-inventory-results";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { handleLocalAsk } from "../src/lib/handlers";
import { visualItem } from "../src/components/use-inventory-store";
import { inventoryContents } from "../src/lib/inventory-scope";
import { itemInput, type Item, type Location } from "../src/lib/inventory";

const owner = "11111111-1111-4111-8111-111111111111";
const home: Location = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: owner,
  name: "Home",
};
const rows: Item[] = Array.from({ length: 250 }, (_, i) => ({
  ...itemInput.parse({ name: `Supply ${i + 1}`, location_id: home.id }),
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i + 1).padStart(12, "0")}`,
  user_id: owner,
  version: 1,
  location_name: home.name,
  created_at: "2026-10-13",
  updated_at: "2026-10-13",
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("restarts a changed inventory scope from zero without mixing old records or sending the stale revision", async () => {
  const user = userEvent.setup();
  const scope = { type: "location" as const, id: home.id };
  const initial = inventoryContents(rows, [home], scope);
  const freshRows = rows.slice(100, 220).map((row) => ({ ...row, version: 2 }));
  const fresh = inventoryContents(freshRows, [home], scope);
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      const url = new URL(path, "http://localhost:3000");
      calls.push(url);
      if (calls.length === 1)
        return Response.json(
          { error: "Inventory changed while paging. Restart results." },
          { status: 409 },
        );
      return Response.json(
        inventoryContents(
          freshRows,
          [home],
          scope,
          Number(url.searchParams.get("offset")),
        ),
      );
    }),
  );
  render(
    <JarvisInventoryResults
      result={{
        answer: "Inventory contents",
        mode: "search",
        citations: [],
        inventoryResult: initial,
      }}
      items={rows.map(visualItem)}
      locations={[home]}
      saved
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("button", { name: /^Open Supply / })).toHaveLength(
    100,
  );
  await user.click(screen.getByRole("button", { name: /Load more/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/changed/i);
  expect(screen.getAllByRole("button", { name: /^Open Supply / })).toHaveLength(
    100,
  );
  expect(calls[0].searchParams.get("revision")).toBe(initial.revision);
  await user.click(screen.getByRole("button", { name: /Restart results/ }));
  expect(
    await screen.findByRole("button", { name: "Open Supply 101" }),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open Supply 1" })).toBeNull();
  expect(calls[1].searchParams.get("offset")).toBe("0");
  expect(calls[1].searchParams.get("revision")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  await user.click(screen.getByRole("button", { name: /Load more/ }));
  expect(
    await screen.findByRole("button", { name: "Open Supply 220" }),
  ).toBeVisible();
  expect(screen.getAllByRole("button", { name: /^Open Supply / })).toHaveLength(
    120,
  );
  expect(calls[2].searchParams.get("revision")).toBe(fresh.revision);
  expect(screen.queryByRole("button", { name: /Load more/ })).toBeNull();
});

it("retains the chosen full path after initial scope failure and retries that exact location", async () => {
  const user = userEvent.setup();
  const bedroom: Location = {
    ...home,
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Bedroom",
    parent_location_id: home.id,
  };
  const chosen = {
    type: "location" as const,
    id: bedroom.id,
    name: bedroom.name,
    path: ["Home", "Bedroom"],
  };
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      urls.push(new URL(path, "http://localhost:3000"));
      if (urls.length === 1)
        return Response.json(
          { error: "Scope unavailable temporarily" },
          { status: 503 },
        );
      return Response.json(inventoryContents([], [home, bedroom], chosen));
    }),
  );
  render(
    <JarvisInventoryResults
      result={{
        answer: "Choose Bedroom",
        mode: "search",
        citations: [],
        scopeChoices: [chosen],
      }}
      items={[]}
      locations={[home, bedroom]}
      saved
      onSelect={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Home → Bedroom" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Scope unavailable temporarily",
  );
  expect(screen.getByText("Selected scope: Home → Bedroom")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Retry selected location" }),
  );
  expect(
    await screen.findByText(/Showing 0 of 0 inventory records/),
  ).toBeVisible();
  expect(screen.getByText("All results loaded.")).toBeVisible();
  expect(urls.map((url) => url.searchParams.get("id"))).toEqual([
    bedroom.id,
    bedroom.id,
  ]);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("answers a sample Space query with its real Room and container descendants across the client/API boundary", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit) => {
      expect(path).toBe("/api/ask/local");
      return handleLocalAsk(
        new Request("http://localhost:3000/api/ask/local", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
          },
          body: options.body,
        }),
      );
    }),
  );
  render(<LiquidDashboard />);
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "Show me everything in Home{Enter}",
  );
  const log = screen.getByRole("log", { name: "Jarvis conversation" });
  expect(
    await within(log).findByText(/Showing 17 of 17 inventory records/),
  ).toBeVisible();
  expect(within(log).getAllByRole("button", { name: /^Open / })).toHaveLength(
    17,
  );
  expect(
    within(log).getByRole("button", { name: "Open Wallet" }),
  ).toBeEnabled();
  expect(
    within(log).getByRole("button", { name: "Open Contact lenses" }),
  ).toHaveTextContent("Home → Bedroom → Cabinet → Drawer");
  expect(
    within(log).queryByRole("button", { name: "Open Backpack" }),
  ).toBeNull();
});

it("keeps partial results visible on page failure, retries the same cursor once, then displays and opens all250 records", async () => {
  const user = userEvent.setup();
  const scope = { type: "location" as const, id: home.id };
  let finish!: (response: Response) => void;
  let attempts = 0;
  const offsets: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) => {
      if (path === "/api/ask")
        return Promise.resolve(
          Response.json({
            answer: "Showing the first100 of250; load the rest.",
            mode: "search",
            citations: [],
            inventoryResult: inventoryContents(rows, [home], scope),
          }),
        );
      const url = new URL(path, "http://localhost:3000");
      expect(url.pathname).toBe("/api/inventory/contents");
      expect(url.searchParams.get("id")).toBe(home.id);
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      if (++attempts === 1)
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      return Promise.resolve(
        Response.json(inventoryContents(rows, [home], scope, offset)),
      );
    }),
  );
  const onSelect = vi.fn();
  render(
    <JarvisChat
      items={rows.map(visualItem)}
      locations={[home]}
      saved
      onSelect={onSelect}
      onApplyChanges={vi.fn()}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "Show me everything in Home{Enter}",
  );
  const log = screen.getByRole("log", { name: "Jarvis conversation" });
  expect(
    await within(log).findByText(/Showing 100 of 250 inventory records/),
  ).toBeVisible();
  expect(within(log).getByText("More results available.")).toBeVisible();
  expect(within(log).queryByText("All results loaded.")).toBeNull();
  expect(
    within(log).getAllByRole("button", { name: /^Open Supply / }),
  ).toHaveLength(100);
  await user.dblClick(within(log).getByRole("button", { name: /Load more/ }));
  expect(offsets).toEqual([100]);
  await act(async () =>
    finish(Response.json({ error: "Page unavailable" }, { status: 503 })),
  );
  expect(await within(log).findByRole("alert")).toHaveTextContent(
    "Page unavailable",
  );
  expect(
    within(log).getAllByRole("button", { name: /^Open Supply / }),
  ).toHaveLength(100);
  await user.click(
    within(log).getByRole("button", { name: /Retry loading.*150 remaining/ }),
  );
  expect(
    await within(log).findByText(/Showing 200 of 250 inventory records/),
  ).toBeVisible();
  await user.click(within(log).getByRole("button", { name: /Load more/ }));
  expect(
    await within(log).findByText(/Showing 250 of 250 inventory records/),
  ).toBeVisible();
  expect(within(log).getByText("All results loaded.")).toBeVisible();
  expect(within(log).queryByText("More results available.")).toBeNull();
  expect(
    within(log).getAllByRole("button", { name: /^Open Supply / }),
  ).toHaveLength(250);
  expect(within(log).queryByRole("button", { name: /Load more/ })).toBeNull();
  expect(offsets).toEqual([100, 100, 200]);
  await user.click(
    within(log).getByRole("button", {
      name: "Open Supply 250",
    }),
  );
  expect(onSelect).toHaveBeenCalledWith(rows[249].id);
});

it("uses the chosen full-path roomID for duplicate-name clarification instead of merging rooms", async () => {
  const user = userEvent.setup();
  const cabin: Location = {
    ...home,
    id: "33333333-3333-4333-8333-333333333333",
    name: "Cabin",
  };
  const homeRoom: Location = {
    ...home,
    id: "44444444-4444-4444-8444-444444444444",
    name: "Bedroom",
    parent_location_id: home.id,
  };
  const cabinRoom: Location = {
    ...homeRoom,
    id: "55555555-5555-4555-8555-555555555555",
    parent_location_id: cabin.id,
  };
  const locations = [home, cabin, homeRoom, cabinRoom];
  const records = [
    { ...rows[0], location_id: homeRoom.id },
    { ...rows[1], location_id: cabinRoom.id },
  ];
  const fetchMock = vi.fn(async (path: string) => {
    if (path === "/api/ask")
      return Response.json({
        answer: "Which Bedroom?",
        mode: "search",
        citations: [],
        scopeChoices: [
          {
            type: "location",
            id: homeRoom.id,
            name: "Bedroom",
            path: ["Home", "Bedroom"],
          },
          {
            type: "location",
            id: cabinRoom.id,
            name: "Bedroom",
            path: ["Cabin", "Bedroom"],
          },
        ],
      });
    const url = new URL(path, "http://localhost:3000");
    expect(url.searchParams.get("id")).toBe(cabinRoom.id);
    return Response.json(
      inventoryContents(records, locations, {
        type: "location",
        id: cabinRoom.id,
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  const onSelect = vi.fn();
  render(
    <JarvisChat
      items={records.map(visualItem)}
      locations={locations}
      saved
      onSelect={onSelect}
      onApplyChanges={vi.fn()}
    />,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "Show me everything in Bedroom{Enter}",
  );
  const log = screen.getByRole("log", { name: "Jarvis conversation" });
  await user.click(
    await within(log).findByRole("button", { name: "Cabin → Bedroom" }),
  );
  expect(
    await within(log).findByText(/Showing 1 of 1 inventory records/),
  ).toBeVisible();
  expect(
    within(log).queryByRole("button", { name: "Open Supply 1" }),
  ).toBeNull();
  await user.click(within(log).getByRole("button", { name: "Open Supply 2" }));
  expect(onSelect).toHaveBeenCalledWith(records[1].id);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
