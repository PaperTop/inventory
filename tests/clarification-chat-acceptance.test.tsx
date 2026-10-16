// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { JarvisChat } from "../src/components/jarvis-chat";
import { handleLocalAsk } from "../src/lib/handlers";
import { itemInput } from "../src/lib/inventory";
import { visualItem } from "../src/components/use-inventory-store";

const bag = visualItem({
  ...itemInput.parse({ name: "Backpack", category: "Travel" }),
  id: "bag",
  user_id: "local",
  version: 1,
  created_at: "2026-10-15",
  updated_at: "2026-10-15",
  location_name: "Test Home",
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([false, true])(
  "preserves a real clarification exchange through the client/API boundary (reply network failure: %s)",
  async (offline) => {
    const user = userEvent.setup();
    const apply = vi.fn(async () => ({ items: [], summary: "" }));
    const provider = {
      answer: vi.fn(async () => ({
        answer:
          "Backpack is a recorded possession. Suggested shelter was not found in the records searched.",
        itemIds: ["bag"],
      })),
    };
    let requests = 0;
    const fetcher = vi.fn(async (path: string, options: RequestInit) => {
      expect(path).toBe("/api/ask/local");
      if (++requests === 2 && offline) throw new TypeError("Synthetic offline");
      return handleLocalAsk(
        new Request("http://localhost:3000/api/ask/local", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
          },
          body: options.body,
        }),
        provider,
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <JarvisChat
        items={[bag]}
        locations={[]}
        saved={false}
        onSelect={vi.fn()}
        onApplyChanges={apply}
      />,
    );
    const prompt = screen.getByRole("textbox", { name: "Ask Jarvis" });
    await user.type(prompt, "Pack me for camping{Enter}");
    const log = screen.getByRole("log", { name: "Jarvis conversation" });
    expect(
      await within(log).findByText(/To tailor your packing list/),
    ).toBeVisible();
    expect(provider.answer).not.toHaveBeenCalled();
    await user.type(
      prompt,
      "Yosemite, two nights, car camping, expected cold rain.{Enter}",
    );
    expect(
      await within(log).findByText(/Backpack.*recorded|Backpack.*1/),
    ).toBeVisible();
    expect(log).toHaveTextContent(/Yosemite/);
    expect(log).toHaveTextContent(/cold rain/);
    expect(
      within(log).getAllByText(/To tailor your packing list/),
    ).toHaveLength(1);
    expect(
      within(log).getByRole("button", { name: "Open Backpack" }),
    ).toBeEnabled();
    expect(JSON.parse(fetcher.mock.calls[1][1].body as string).history).toEqual(
      [
        {
          question: "Pack me for camping",
          answer: expect.stringContaining("To tailor your packing list"),
        },
      ],
    );
    expect(apply).not.toHaveBeenCalled();
    expect(provider.answer).toHaveBeenCalledTimes(offline ? 0 : 1);
    if (offline)
      expect(log).toHaveTextContent(/local|unavailable|could not reach/i);
  },
);

it("a basic-list reply exits questions in the visible conversation with labeled assumptions and no inventory changes", async () => {
  const user = userEvent.setup();
  const apply = vi.fn(async () => ({ items: [], summary: "" }));
  const provider = {
    answer: vi.fn(async () => ({
      answer:
        "Backpack is owned; suggested shelter is not found in the records searched.",
      itemIds: ["bag"],
    })),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_path: string, options: RequestInit) =>
      handleLocalAsk(
        new Request("http://localhost:3000/api/ask/local", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
          },
          body: options.body,
        }),
        provider,
      ),
    ),
  );
  render(
    <JarvisChat
      items={[bag]}
      locations={[]}
      saved={false}
      onSelect={vi.fn()}
      onApplyChanges={apply}
    />,
  );
  const prompt = screen.getByRole("textbox", { name: "Ask Jarvis" });
  await user.type(prompt, "Pack me for camping{Enter}");
  const log = screen.getByRole("log", { name: "Jarvis conversation" });
  expect(
    await within(log).findByText(/To tailor your packing list/),
  ).toBeVisible();
  await user.type(prompt, "Basic list, please{Enter}");
  expect(await within(log).findByText(/Backpack is owned/)).toBeVisible();
  expect(log).toHaveTextContent(/Provisional assumptions/);
  expect(within(log).getAllByText(/To tailor your packing list/)).toHaveLength(
    1,
  );
  expect(provider.answer).toHaveBeenCalledOnce();
  expect(apply).not.toHaveBeenCalled();
});
