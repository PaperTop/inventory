// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JarvisChat } from "../src/components/jarvis-chat";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("does not apply a pending local change after the saved inventory takes over", async () => {
  let resolve!: (response: unknown) => void;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const onApplyChanges = vi.fn(async () => ({
    items: [],
    summary: "Added tent.",
  }));
  const props = { items: [], onSelect: () => {}, onApplyChanges };
  const user = userEvent.setup();
  const { rerender } = render(<JarvisChat {...props} saved={false} />);
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "Add a tent",
  );
  await user.click(screen.getByRole("button", { name: "Send question" }));
  rerender(<JarvisChat {...props} saved={true} />);
  await act(async () =>
    resolve({
      ok: true,
      json: async () => ({
        mode: "ai",
        answer: "Prepared",
        citations: [],
        changes: [{ type: "create", item: { name: "Tent" } }],
      }),
    }),
  );
  await waitFor(() =>
    expect(screen.getByText("No items were changed.")).toBeVisible(),
  );
  expect(onApplyChanges).not.toHaveBeenCalled();
  expect(screen.getByRole("textbox", { name: "Ask Jarvis" })).toBeEnabled();
});

it("resets chat exchanges and restores the welcome state when Reset is clicked", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          mode: "ai",
          answer: "Here is your camera.",
          citations: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  const props = {
    items: [],
    onSelect: () => {},
    onApplyChanges: async () => ({ items: [], summary: "" }),
  };
  const user = userEvent.setup();
  render(<JarvisChat {...props} saved={false} />);

  expect(screen.getByText(/Tell me what you’re planning/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Reset chat" })).toBeNull();

  const input = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(input, "Where is my camera?");
  await user.click(screen.getByRole("button", { name: "Send question" }));

  await waitFor(() =>
    expect(screen.getByText("Here is your camera.")).toBeVisible(),
  );
  expect(screen.queryByText(/Tell me what you’re planning/i)).toBeNull();

  const resetButton = screen.getByRole("button", { name: "Reset chat" });
  expect(resetButton).toBeVisible();

  await user.click(resetButton);

  expect(screen.getByText(/Tell me what you’re planning/i)).toBeVisible();
  expect(screen.queryByText("Here is your camera.")).toBeNull();
  expect(screen.queryByRole("button", { name: "Reset chat" })).toBeNull();
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
});
