import { AIMessage } from "@langchain/core/messages";
import { expect, it, vi } from "vitest";
import { createReadOnlyAnswerGraph } from "../src/lib/answer-graph";
import { askInventory, type InventoryFact } from "../src/lib/ask";

const item: InventoryFact = {
  id: "test-charger",
  name: "Charger",
  category: "Electronics",
  description: "Synthetic fixture",
  quantity: 1,
  unit: "pc",
  status: "active",
  condition: "good",
  location_name: "Test shelf",
  tags: [],
  attributes: {},
};

it("recovers one malformed answer with tools disabled and the original evidence preserved", async () => {
  const invoke = vi.fn(async (_messages, options) => {
    if (invoke.mock.calls.length === 1)
      return new AIMessage("Your charger is on Test shelf.");
    expect(options.finalAnswer).toBe(true);
    expect(String(_messages.at(-1).content)).toMatch(/JSON/);
    return new AIMessage(
      '{"answer":"Charger is on Test shelf.","itemIds":["test-charger"]}',
    );
  });
  const result = await askInventory(
    "Find charger",
    { search: async () => [item] },
    createReadOnlyAnswerGraph({ invoke }),
  );
  expect(result.mode, result.notice).toBe("ai");
  expect(result.citations).toEqual([item]);
  expect(invoke).toHaveBeenCalledTimes(2);
});

it("does not retry repeated malformed answers indefinitely", async () => {
  const invoke = vi.fn(async () => new AIMessage("Not JSON"));
  const result = await askInventory(
    "Find charger",
    { search: async () => [item] },
    createReadOnlyAnswerGraph({ invoke }),
  );
  expect(result.mode).toBe("search");
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(result.changes).toBeUndefined();
});

it("still rejects invented citations after a formatting correction", async () => {
  let calls = 0;
  const result = await askInventory(
    "Find charger",
    { search: async () => [item] },
    createReadOnlyAnswerGraph({
      invoke: async () =>
        new AIMessage(
          ++calls === 1
            ? "Not JSON"
            : '{"answer":"Invented tent","itemIds":["foreign"]}',
        ),
    }),
  );
  expect(result.mode).toBe("search");
  expect(result.notice).toMatch(/not retrieved/);
  expect(result.answer).not.toContain("Invented tent");
});

it("repairs a schema-invalid JSON answer without relaxing the schema", async () => {
  let calls = 0;
  const provider = createReadOnlyAnswerGraph({
    invoke: async () =>
      new AIMessage(
        JSON.stringify(
          ++calls === 1
            ? { answer: "x".repeat(4001), itemIds: [item.id], extra: true }
            : { answer: "Charger is on Test shelf.", itemIds: [item.id] },
        ),
      ),
  });
  await expect(
    provider.answer({ question: "Find charger", items: [item] }),
  ).resolves.toEqual({
    answer: "Charger is on Test shelf.",
    itemIds: [item.id],
  });
  expect(calls).toBe(2);
});

it("never executes tools during a correction", async () => {
  let calls = 0;
  const prepareChange = vi.fn();
  const provider = createReadOnlyAnswerGraph({
    invoke: async () =>
      ++calls === 1
        ? new AIMessage("Not JSON")
        : new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "write",
                name: "create_item",
                args: { item: { name: "Tent" } },
              },
            ],
          }),
  });
  await expect(
    provider.answer(
      { question: "Add a tent", items: [item] },
      { search: async () => [item], prepareChange },
    ),
  ).rejects.toMatchObject({ reason: "tool_budget" });
  expect(prepareChange).not.toHaveBeenCalled();
  expect(calls).toBe(2);
});

it("does not add a fifth call when the fourth answer is malformed", async () => {
  let calls = 0;
  const provider = createReadOnlyAnswerGraph({
    invoke: async () =>
      ++calls < 4
        ? new AIMessage({
            content: "",
            tool_calls: [
              {
                id: `lookup-${calls}`,
                name: "search_inventory",
                args: { query: "charger" },
              },
            ],
          })
        : new AIMessage("Not JSON"),
  });
  await expect(
    provider.answer({ question: "Find charger", items: [item] }),
  ).rejects.toMatchObject({ reason: "answer_json" });
  expect(calls).toBe(4);
});
