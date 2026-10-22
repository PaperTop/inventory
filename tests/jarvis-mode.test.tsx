// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JarvisChat } from "../src/components/jarvis-chat";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const props = {
  items: [],
  saved: false,
  onSelect: vi.fn(),
  onApplyChanges: vi.fn(async () => ({ items: [], summary: "" })),
};
const mode = () =>
  screen.getByRole("status", { name: "Jarvis operating mode" });

it.each([
  [true, "AI assistant"],
  [false, "Basic search"],
  [undefined, "Mode not checked"],
] as const)(
  "shows initial capability %s without extra requests",
  (aiAvailable, label) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<JarvisChat {...props} aiAvailable={aiAvailable} />);
    expect(mode()).toHaveTextContent(label);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("does not label a deterministic greeting as an AI outage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        mode: "search",
        conversational: true,
        answer: "Hi!",
        citations: [],
      }),
    ),
  );
  render(<JarvisChat {...props} aiAvailable />);
  await userEvent
    .setup()
    .type(screen.getByRole("textbox", { name: "Ask Jarvis" }), "hi{Enter}");
  await screen.findByText("Hi!");
  expect(mode()).toHaveTextContent("AI assistant");
});

it("shows Basic search after a fallback and recovers after a successful AI reply", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        mode: "search",
        answer: "Search result.",
        notice: "The AI request timed out.",
        citations: [],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ mode: "ai", answer: "AI reply.", citations: [] }),
    );
  vi.stubGlobal("fetch", fetch);
  render(<JarvisChat {...props} aiAvailable />);
  const user = userEvent.setup();
  const input = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(input, "Find camera{Enter}");
  await screen.findByText("Search result.");
  expect(mode()).toHaveTextContent("Basic search");
  await user.type(input, "Find charger{Enter}");
  await screen.findByText("AI reply.");
  expect(mode()).toHaveTextContent("AI assistant");
});
