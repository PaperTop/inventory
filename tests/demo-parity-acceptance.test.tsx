// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { handleLocalAsk } from "../src/lib/handlers";
import { JarvisChat } from "../src/components/jarvis-chat";
import { itemInput } from "../src/lib/inventory";
import { visualItem } from "../src/components/use-inventory-store";

const question = "Do I have anything I can use to take pictures?";
const camera = visualItem({
  ...itemInput.parse({ name: "Synthetic camera", category: "Photography" }),
  id: "synthetic-camera",
  user_id: "local",
  version: 1,
  created_at: "2026-10-16",
  updated_at: "2026-10-16",
  location_name: "Synthetic shelf",
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each(["development", "production"])(
  "shows the actual demo inference mode in %s with identical inventory and question",
  async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    const provider = {
      answer: vi.fn(async () => ({
        answer:
          "Your synthetic camera can take pictures; it is on Synthetic shelf.",
        itemIds: [camera.id],
      })),
    };
    const statuses: number[] = [];
    const fetcher = vi.fn(async (path: string, options: RequestInit) => {
      expect(path).toBe("/api/ask/local");
      const response = await handleLocalAsk(
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
      statuses.push(response.status);
      return response;
    });
    vi.stubGlobal("fetch", fetcher);
    const apply = vi.fn(async () => ({ items: [], summary: "" }));
    render(
      <JarvisChat
        items={[camera]}
        locations={[]}
        saved={false}
        onSelect={vi.fn()}
        onApplyChanges={apply}
      />,
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Ask Jarvis" }),
      `${question}{Enter}`,
    );
    const log = screen.getByRole("log", { name: "Jarvis conversation" });
    expect(
      await within(log).findByRole("button", { name: "Open Synthetic camera" }),
    ).toBeEnabled();
    if (environment === "development") {
      expect(statuses).toEqual([200]);
      expect(provider.answer).toHaveBeenCalledOnce();
      expect(log).toHaveTextContent(/AI answer/);
      expect(log).not.toHaveTextContent(/could not reach the AI service/);
    } else {
      expect(statuses).toEqual([404]);
      expect(provider.answer).not.toHaveBeenCalled();
      expect(log).toHaveTextContent(/Search results/);
      expect(log).toHaveTextContent(
        /could not reach the AI service.*local search results/i,
      );
      await user.type(
        screen.getByRole("textbox", { name: "Ask Jarvis" }),
        "Where is the synthetic camera?{Enter}",
      );
      expect(
        await within(log).findAllByRole("button", {
          name: "Open Synthetic camera",
        }),
      ).toHaveLength(2);
      const body = JSON.parse(fetcher.mock.calls[1][1].body as string);
      expect(body.history).toEqual([{ question, answer: expect.any(String) }]);
      expect(provider.answer).not.toHaveBeenCalled();
    }
    expect(apply).not.toHaveBeenCalled();
  },
);

it("a production-disabled demo endpoint still shows a greeting without irrelevant cards, trip questions or an AI outage warning", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const provider = {
    answer: vi.fn(async () => ({ answer: "Should not run", itemIds: [] })),
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
      items={[camera]}
      locations={[]}
      saved={false}
      onSelect={vi.fn()}
      onApplyChanges={vi.fn(async () => ({ items: [], summary: "" }))}
    />,
  );
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: "Ask Jarvis" }),
    "hi{Enter}",
  );
  const log = screen.getByRole("log", { name: "Jarvis conversation" });
  expect(await within(log).findByText(/Hi! I can help/)).toBeVisible();
  expect(within(log).queryByRole("button", { name: /^Open / })).toBeNull();
  expect(log).not.toHaveTextContent(/could not reach|Trip questions|To tailor/);
  expect(provider.answer).not.toHaveBeenCalled();
});
