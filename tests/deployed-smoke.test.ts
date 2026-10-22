import { afterEach, expect, it, vi } from "vitest";
import { runDeployedSmoke } from "../scripts/smoke-deployed.mjs";
import { handleLocalAsk } from "../src/lib/handlers";

afterEach(() => vi.unstubAllEnvs());
it("exercises real handler greetings, complete locations and packing history without writes", async () => {
  const histories: unknown[] = [];
  const provider = {
    answer: vi.fn(async (context) => {
      histories.push(context.history);
      return {
        answer: "Pack the backpack from Smoke home.",
        itemIds: ["release-smoke-0"],
      };
    }),
  };
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
    if (init?.method === "GET")
      return Response.json({ mode: "ai", release: "release-test" });
    return handleLocalAsk(new Request(url, init), provider);
  });
  const result = await runDeployedSmoke({
    url: "https://demo.example",
    expectedRelease: "release-test",
    fetchImpl,
  });
  expect(result.checks).toHaveLength(4);
  expect(provider.answer).toHaveBeenCalledTimes(2);
  expect(histories[1]).toEqual([
    {
      question: expect.stringMatching(/camping/),
      answer: "Pack the backpack from Smoke home.",
    },
  ]);
  expect(fetchImpl).toHaveBeenCalledTimes(5);
});
it("fails before spending tokens if the deployment is stale or AI is disabled", async () => {
  const fetchImpl = vi.fn<typeof fetch>(async () =>
    Response.json({ mode: "ai", release: "old-release" }),
  );
  await expect(
    runDeployedSmoke({
      url: "https://demo.example",
      expectedRelease: "new-release",
      fetchImpl,
    }),
  ).rejects.toThrow(/expected release/);
  expect(fetchImpl).toHaveBeenCalledOnce();
  fetchImpl.mockResolvedValue(
    Response.json({ mode: "search", release: "new-release" }),
  );
  await expect(
    runDeployedSmoke({ url: "https://demo.example", fetchImpl }),
  ).rejects.toThrow(/not enabled/);
});
it("rejects unsafe smoke URL credentials before any request", async () => {
  const fetchImpl = vi.fn<typeof fetch>();
  await expect(
    runDeployedSmoke({ url: "https://user:password@demo.example", fetchImpl }),
  ).rejects.toThrow(/credentials/);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("fails instead of calling basic search a successful AI packing check", async () => {
  const provider = {
    answer: vi.fn(async () => {
      throw new Error("Synthetic provider outage");
    }),
  };
  const fetchImpl = vi.fn<typeof fetch>(async (url, init) =>
    init?.method === "GET"
      ? Response.json({ mode: "ai", release: "test" })
      : handleLocalAsk(new Request(url, init), provider),
  );
  await expect(
    runDeployedSmoke({ url: "https://demo.example", fetchImpl }),
  ).rejects.toThrow(/Packing fell back/);
  expect(provider.answer).toHaveBeenCalledOnce();
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});
