// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { InventoryApp } from "../src/components/inventory-app";
import { apiRepository } from "../src/lib/browser-api";
import { itemInput, type Item } from "../src/lib/inventory";

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../src/lib/supabase/config", () => ({ isConfigured: () => true }));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({ auth }),
}));
const account = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "first@example.com",
};
const second = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "second@example.com",
};
const camera: Item = {
  ...itemInput.parse({ name: "Private camera" }),
  id: "33333333-3333-4333-8333-333333333333",
  user_id: account.id,
  version: 1,
  location_name: null,
  created_at: "2026-09-16",
  updated_at: "2026-09-16",
};
let initial: typeof account | null;
let emit: (event: string, session: { user: typeof account } | null) => void;
beforeEach(() => {
  initial = null;
  auth.onAuthStateChange.mockImplementation((callback) => {
    emit = callback;
    let active = true;
    queueMicrotask(() => {
      if (active)
        callback("INITIAL_SESSION", initial ? { user: initial } : null);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            active = false;
          },
        },
      },
    };
  });
  auth.signInWithPassword.mockImplementation(async () => {
    emit("SIGNED_IN", { user: account });
    return { data: { session: { user: account } }, error: null };
  });
  auth.signOut.mockImplementation(async () => {
    emit("SIGNED_OUT", null);
    return { error: null };
  });
  vi.spyOn(apiRepository, "list").mockResolvedValue([camera]);
  vi.spyOn(apiRepository, "locations").mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

it("shows signed-out sample mode and loads only saved records after login", async () => {
  const user = userEvent.setup();
  render(<InventoryApp />);
  await user.click(await screen.findByRole("button", { name: "All items" }));
  await screen.findByRole("button", { name: "View Backpack" });
  expect(apiRepository.list).not.toHaveBeenCalled();
  await user.click(screen.getByText("Settings"));
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Email"), account.email);
  await user.type(
    within(dialog).getByLabelText("Password", { exact: true }),
    "test-password",
  );
  await user.click(within(dialog).getByRole("button", { name: "Sign in" }));
  await user.click(await screen.findByRole("button", { name: "All items" }));
  expect(
    await screen.findByRole("button", { name: "View Private camera" }),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: "View Backpack" })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByText("Settings"));
  expect(screen.getByText(account.email)).toBeVisible();
});

it("keeps signed-in load errors distinct from sample inventory and supports retry", async () => {
  initial = account;
  vi.mocked(apiRepository.list).mockRejectedValueOnce(
    new Error("Database unavailable"),
  );
  const user = userEvent.setup();
  render(<InventoryApp />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Database unavailable",
  );
  expect(screen.queryByRole("button", { name: "View Backpack" })).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Retry loading inventory" }),
  );
  await user.click(await screen.findByRole("button", { name: "All items" }));
  expect(
    await screen.findByRole("button", { name: "View Private camera" }),
  ).toBeVisible();
});

it("clears private inventory immediately on logout and does not sign out other devices", async () => {
  initial = account;
  let finish!: () => void;
  auth.signOut.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => {
          emit("SIGNED_OUT", null);
          resolve({ error: null });
        };
      }),
  );
  const user = userEvent.setup();
  render(<InventoryApp />);
  await user.click(await screen.findByRole("button", { name: "All items" }));
  await screen.findByRole("button", { name: "View Private camera" });
  await user.click(screen.getByText("Settings"));
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(
    screen.queryByRole("button", { name: "View Private camera" }),
  ).toBeNull();
  expect(screen.getByText("Signing out…")).toBeVisible();
  await act(async () => finish());
  await user.click(await screen.findByRole("button", { name: "All items" }));
  expect(
    await screen.findByRole("button", { name: "View Backpack" }),
  ).toBeVisible();
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

it("reports failed logout instead of claiming the session ended", async () => {
  initial = account;
  auth.signOut.mockResolvedValue({ error: { message: "offline" } });
  const user = userEvent.setup();
  render(<InventoryApp />);
  await user.click(await screen.findByRole("button", { name: "All items" }));
  await screen.findByRole("button", { name: "View Private camera" });
  await user.click(screen.getByText("Settings"));
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /could not sign out/i,
  );
  await user.click(screen.getByRole("button", { name: "All items" }));
  expect(
    await screen.findByRole("button", { name: "View Private camera" }),
  ).toBeVisible();
});

it("ignores an old account's delayed inventory response", async () => {
  const user = userEvent.setup();
  initial = account;
  let finish!: (rows: Item[]) => void;
  vi.mocked(apiRepository.list)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue([]);
  render(<InventoryApp />);
  await waitFor(() => expect(apiRepository.list).toHaveBeenCalledOnce());
  act(() => emit("SIGNED_IN", { user: second }));
  await user.click(await screen.findByRole("button", { name: "All items" }));
  await screen.findByText("Your inventory starts here");
  await act(async () => finish([camera]));
  expect(
    screen.queryByRole("button", { name: "View Private camera" }),
  ).toBeNull();
  await user.click(screen.getByText("Settings"));
  expect(screen.getByText(second.email)).toBeVisible();
});

it("does not display records whose owner differs from the current session", async () => {
  initial = second;
  render(<InventoryApp />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /session changed/i,
  );
  expect(
    screen.queryByRole("button", { name: "View Private camera" }),
  ).toBeNull();
});

it("clears chat on an account switch and ignores its late answer", async () => {
  initial = account;
  let answer!: (response: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      path === "/api/ask"
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve(
            Response.json({ error: "Unavailable" }, { status: 503 }),
          ),
    ),
  );
  const user = userEvent.setup();
  render(<InventoryApp />);
  await user.click(await screen.findByRole("button", { name: "All items" }));
  await screen.findByRole("button", { name: "View Private camera" });
  await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "My private question",
  );
  await user.click(screen.getByRole("button", { name: "Send to Jarvis" }));
  expect(screen.getByText("My private question")).toBeVisible();
  vi.mocked(apiRepository.list).mockResolvedValue([]);
  act(() => emit("SIGNED_IN", { user: second }));
  await user.click(await screen.findByRole("button", { name: "All items" }));
  await screen.findByText("Your inventory starts here");
  const create = vi.spyOn(apiRepository, "create");
  await act(async () =>
    answer({
      ok: true,
      json: async () => ({
        mode: "ai",
        answer: "Old account answer",
        citations: [],
        changes: [{ type: "create", item: { name: "Old account item" } }],
      }),
    }),
  );
  expect(screen.queryByText("My private question")).toBeNull();
  expect(screen.queryByText("Old account answer")).toBeNull();
  expect(create).not.toHaveBeenCalled();
});

it("shows invalid confirmation feedback and removes the URL marker", async () => {
  window.history.replaceState({}, "", "/?authError=confirmation");
  render(<InventoryApp />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /invalid or expired/i,
  );
  expect(window.location.search).toBe("");
});
