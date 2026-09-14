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

  it("rejects rich content blocks instead of guessing at model output", async () => {
    const model: ReadOnlyChatModel = {
      async invoke() {
        return new AIMessage({
          content: [{ type: "text", text: '{"answer":"x","itemIds":[]}' }],
        });
      },
    };

    const provider = createReadOnlyAnswerGraph(model);
    await expect(provider.answer(context)).rejects.toThrow(/plain text/i);
  });
});
