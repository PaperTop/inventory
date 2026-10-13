// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JarvisChat } from "../src/components/jarvis-chat";
import { StrictMode } from "react";
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
  await user.click(screen.getByRole("button", { name: "Send to Jarvis" }));
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

it("resets conversation exchanges and returns to the minimal composer", async () => {
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

  expect(
    screen.getByRole("log", { name: "Jarvis conversation" }),
  ).toBeEmptyDOMElement();
  expect(
    screen.queryByRole("button", { name: "Reset conversation" }),
  ).toBeNull();

  const input = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(input, "Where is my camera?");
  await user.click(screen.getByRole("button", { name: "Send to Jarvis" }));

  await waitFor(() =>
    expect(screen.getByText("Here is your camera.")).toBeVisible(),
  );
  expect(
    screen.getByRole("log", { name: "Jarvis conversation" }),
  ).toHaveTextContent("Where is my camera?");

  const resetButton = screen.getByRole("button", {
    name: "Reset conversation",
  });
  expect(resetButton).toBeVisible();

  await user.click(resetButton);

  expect(
    screen.getByRole("log", { name: "Jarvis conversation" }),
  ).toBeEmptyDOMElement();
  expect(screen.queryByText("Here is your camera.")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Reset conversation" }),
  ).toBeNull();
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
});

it("submits a dashboard prompt through the existing Jarvis workflow", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          mode: "ai",
          answer: "Here is a read-only organization plan.",
          citations: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <JarvisChat
      saved={false}
      items={[]}
      onSelect={() => {}}
      onApplyChanges={async () => ({ items: [], summary: "" })}
      promptRequest={{
        id: 1,
        text: "Help me organize my camera gear without making changes.",
        submit: true,
      }}
    />,
  );

  expect(
    await screen.findByText(
      "Help me organize my camera gear without making changes.",
    ),
  ).toBeVisible();
  expect(
    await screen.findByText("Here is a read-only organization plan."),
  ).toBeVisible();
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("submits a requested prompt once in Strict Mode and preserves a follow-up draft and focus while replying", async () => {
  let finish!: (response: Response) => void;
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(
    <StrictMode>
      <JarvisChat
        saved={false}
        items={[]}
        onSelect={() => {}}
        onApplyChanges={async () => ({ items: [], summary: "" })}
        promptRequest={{ id: 1, text: "Plan my camera gear", submit: true }}
      />
    </StrictMode>,
  );
  expect(screen.getByText("Plan my camera gear")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledOnce();
  const input = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(input, "What else do I need?");
  expect(screen.getByRole("button", { name: "Send to Jarvis" })).toBeDisabled();
  await act(async () =>
    finish(
      Response.json({
        mode: "ai",
        answer: "Bring your camera.",
        citations: [],
      }),
    ),
  );
  expect(await screen.findByText("Bring your camera.")).toBeVisible();
  expect(input).toHaveValue("What else do I need?");
  expect(input).toHaveFocus();
  expect(screen.getByRole("button", { name: "Send to Jarvis" })).toBeEnabled();
});
