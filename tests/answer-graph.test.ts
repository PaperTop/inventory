import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import {
  createReadOnlyAnswerGraph,
  type ReadOnlyChatModel,
} from "../src/lib/answer-graph";

const context = {
  question: "Where is my charger?",
  items: [
    {
      id: "item-1",
      name: "USB-C charger",
      description: "65W charger",
      category: "Electronics",
      quantity: 1,
      unit: "item",
      status: "active" as const,
      condition: "good" as const,
      location_name: "Backpack",
      tags: ["travel"],
      attributes: {},
    },
  ],
};

describe("read-only LangGraph answer workflow", () => {
  it("reserves the fourth turn for a grounded final answer instead of offering an unusable search", async () => {
    let calls = 0;
    let searches = 0;
    const provider = createReadOnlyAnswerGraph({
      async invoke(
        messages,
        options?: { signal: AbortSignal; finalAnswer?: boolean },
      ) {
        calls++;
        if (options?.finalAnswer) {
          expect(calls).toBe(4);
          expect(String(messages.at(-1)?.content)).toMatch(/final answer/i);
          return new AIMessage(
            JSON.stringify({
              answer:
                "Your charger is in Backpack. Other supplies were not found in the records searched.",
              itemIds: ["item-1"],
            }),
          );
        }
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: `search-${calls}`,
              name: "search_inventory",
              args: { query: "charger" },
            },
          ],
        });
      },
    });
    await expect(
      provider.answer(context, {
        search: async () => {
          searches++;
          return context.items;
        },
      }),
    ).resolves.toMatchObject({ itemIds: ["item-1"] });
    expect(calls).toBe(4);
    expect(searches).toBe(3);
  });

  it("still stops repeated invalid search requests at the existing four-turn limit", async () => {
    let calls = 0;
    let searches = 0;
    const provider = createReadOnlyAnswerGraph({
      async invoke() {
        calls++;
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: `invalid-${calls}`,
              name: "search_inventory",
              args: { query: "x".repeat(201) },
            },
          ],
        });
      },
    });
    await expect(
      provider.answer(context, {
        search: async () => {
          searches++;
          return [];
        },
      }),
    ).rejects.toThrow("tool loop limit");
    expect(calls).toBe(4);
    expect(searches).toBe(0);
  });

  it("lets the model correct an oversized search without running it or expanding its turn budget", async () => {
    let calls = 0;
    const queries: string[] = [];
    const provider = createReadOnlyAnswerGraph({
      async invoke(messages) {
        calls++;
        if (calls === 2) {
          expect(String(messages.at(-2)?.content)).toContain("200 characters");
        }
        if (calls <= 2)
          return new AIMessage({
            content: "",
            tool_calls: [
              {
                id: `search-${calls}`,
                name: "search_inventory",
                args: { query: calls === 1 ? "x".repeat(201) : "charger" },
              },
            ],
          });
        return new AIMessage(
          JSON.stringify({
            answer: "Your charger is in Backpack.",
            itemIds: ["item-1"],
          }),
        );
      },
    });
    await expect(
      provider.answer(context, {
        search: async (query) => {
          queries.push(query);
          return context.items;
        },
      }),
    ).resolves.toMatchObject({ itemIds: ["item-1"] });
    expect(queries).toEqual(["charger"]);
    expect(calls).toBe(3);
  });

  it("returns a structured answer from one model invocation", async () => {
    let calls = 0;
    const model: ReadOnlyChatModel = {
      async invoke(messages) {
        calls += 1;
        expect(messages).toHaveLength(2);
        expect(String(messages[0].content)).toMatch(/read-only/i);
        expect(String(messages[1].content)).toContain("USB-C charger");
        return new AIMessage(
          JSON.stringify({
            answer: "Your USB-C charger is in your Backpack.",
            itemIds: ["item-1"],
          }),
        );
      },
    };

    const provider = createReadOnlyAnswerGraph(model);
    await expect(provider.answer(context)).resolves.toEqual({
      answer: "Your USB-C charger is in your Backpack.",
      itemIds: ["item-1"],
    });
    expect(calls).toBe(1);
  });

  it("rejects malformed model output before it reaches the Ask service", async () => {
    const model: ReadOnlyChatModel = {
      async invoke() {
        return new AIMessage("The charger is probably somewhere nearby.");
      },
    };

    const provider = createReadOnlyAnswerGraph(model);
    await expect(provider.answer(context)).rejects.toThrow();
  });

  it("accepts text content blocks while validating their answer schema", async () => {
    const model: ReadOnlyChatModel = {
      async invoke() {
        return new AIMessage({
          content: [{ type: "text", text: '{"answer":"x","itemIds":[]}' }],
        });
      },
    };

    const provider = createReadOnlyAnswerGraph(model);
    await expect(provider.answer(context)).resolves.toEqual({
      answer: "x",
      itemIds: [],
    });
  });
});
