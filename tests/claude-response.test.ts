import { afterEach, expect, it, vi } from "vitest";
import { configuredProvider } from "../src/lib/provider";
import { askInventory, type InventoryFact } from "../src/lib/ask";
import { searchFacts } from "../src/lib/inventory-search";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const item: InventoryFact = {
  id: "test-charger",
  name: "USB-C charger",
  description: "Fabricated test record",
  category: "Electronics",
  quantity: 1,
  unit: "pc",
  status: "active",
  condition: "good",
  location_name: "Test shelf",
  tags: [],
  attributes: {},
};

function mockClaude(responses: Record<string, unknown>[]) {
  vi.stubEnv("AI_PROVIDER", "claude");
  vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-test-key");
  vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-5-5");
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const response = responses.shift();
    if (!response) throw new Error("Unexpected extra model request");
    return Response.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-haiku-5-5",
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 50 },
      ...response,
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

it("uses the real Claude adapter through a search round and accepts its text blocks", async () => {
  const fetch = mockClaude([
    {
      stop_reason: "tool_use",
      content: [
        { type: "thinking", thinking: "Private reasoning", signature: "test" },
        {
          type: "tool_use",
          id: "tool_test",
          name: "search_inventory",
          input: { query: "charger" },
        },
      ],
    },
    {
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "Not user-visible", signature: "test2" },
        {
          type: "text",
          text: JSON.stringify({
            answer: "Your USB-C charger is on the Test shelf.",
            itemIds: [item.id],
          }),
        },
      ],
    },
  ]);
  const result = await askInventory(
    "Find my USB-C charger",
    { search: async (query) => searchFacts([item], query) },
    configuredProvider(),
  );
  expect(result.mode, result.notice).toBe("ai");
  expect(result.answer).toBe("Your USB-C charger is on the Test shelf.");
  expect(result.citations).toEqual([item]);
  expect(fetch).toHaveBeenCalledTimes(2);
  const requests = fetch.mock.calls.map(([, init]) =>
    JSON.parse(String(init?.body)),
  );
  expect(requests[0]).toMatchObject({
    max_tokens: 2400,
    output_config: { effort: "low" },
  });
  expect(requests[0]).not.toHaveProperty("temperature");
  expect(requests[1].system).toEqual(requests[0].system);
  expect(requests[1].messages[1].content).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "thinking", signature: "test" }),
    ]),
  );
});

it("never treats a thinking block as an answer", async () => {
  mockClaude([
    {
      stop_reason: "end_turn",
      content: [
        {
          type: "thinking",
          thinking: '{"answer":"unsafe","itemIds":[]}',
          signature: "test",
        },
      ],
    },
  ]);
  await expect(
    configuredProvider()!.answer({ question: "Find charger", items: [item] }),
  ).rejects.toMatchObject({ reason: "answer_schema" });
});

it("keeps citation validation for Claude text blocks", async () => {
  mockClaude([
    {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: '{"answer":"Invented possession","itemIds":["foreign-item"]}',
        },
      ],
    },
  ]);
  const result = await askInventory(
    "Find charger",
    { search: async () => [item] },
    configuredProvider(),
  );
  expect(result.mode).toBe("search");
  expect(result.notice).toContain("not retrieved");
  expect(result.answer).not.toContain("Invented possession");
  expect(result.changes).toBeUndefined();
});

it("reports a Claude refusal without parsing it as answer JSON", async () => {
  mockClaude([
    { stop_reason: "refusal", content: [{ type: "text", text: "Declined" }] },
  ]);
  await expect(
    configuredProvider()!.answer({ question: "Find charger", items: [item] }),
  ).rejects.toMatchObject({ reason: "refusal" });
});

it.each([
  [401, "authentication"],
  [404, "model was not found"],
  [429, "rate limit"],
] as const)(
  "explains HTTP %s without leaking provider details or retrying",
  async (status, explanation) => {
    const fetch = mockClaude([]);
    fetch.mockResolvedValue(
      Response.json(
        {
          type: "error",
          error: { type: "api_error", message: "private provider details" },
        },
        { status },
      ),
    );
    const result = await askInventory(
      "Find charger",
      { search: async () => [item] },
      configuredProvider(),
    );
    expect(result.mode).toBe("search");
    expect(result.notice).toContain(explanation);
    expect(result.notice).not.toContain("private provider details");
    expect(result.changes).toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it("identifies Claude output truncation before attempting to parse incomplete JSON", async () => {
  mockClaude([
    {
      stop_reason: "max_tokens",
      content: [{ type: "text", text: '{"answer":' }],
    },
  ]);
  await expect(
    configuredProvider()!.answer({ question: "Find charger", items: [item] }),
  ).rejects.toMatchObject({ reason: "output_limit" });
});
