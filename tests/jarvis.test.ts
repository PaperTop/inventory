import { describe, expect, it } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { askInventory } from "../src/lib/ask";
import { createReadOnlyAnswerGraph } from "../src/lib/answer-graph";
import { itemInput, searchInventory, type Item } from "../src/lib/inventory";

function item(id: string, name: string, extra: Partial<Item> = {}): Item {
  return {
    ...itemInput.parse({ name }),
    id,
    user_id: "owner",
    version: 1,
    created_at: "2026-09-15",
    updated_at: "2026-09-15",
    location_name: "Bedroom",
    ...extra,
  };
}
const rows = [
  item("bag", "Backpack"),
  item("shoes", "Sneakers"),
  item("water", "Water bottle"),
  item("camera", "Compact camera"),
  item("phone", "Smartphone"),
  item("headphones", "Headphones"),
  item("tripod", "Travel tripod", { tags: ["photography"] }),
  item("card", "SD card", { description: "Memory card for my camera" }),
  item("lens", "35 mm lens", { status: "lent" }),
  item("tent", "Tent", { status: "disposed" }),
  item("soap", "Soap"),
  item("contacts", "Daily contact lenses", { category: "Personal care" }),
  item("bandages", "Bandages", { category: "Health" }),
];
const reader = {
  search: async (query: string) => searchInventory(rows, query),
};

describe("Jarvis inventory retrieval", () => {
  it("assembles a camping list from usable possessions without inventing missing gear", async () => {
    const result = await askInventory("Pack me for camping", reader);
    expect(result.citations.map((i) => i.id)).toEqual(
      expect.arrayContaining([
        "bag",
        "shoes",
        "water",
        "contacts",
        "bandages",
        "soap",
      ]),
    );
    expect(result.citations.map((i) => i.id)).not.toContain("tent");
    expect(result.answer).toMatch(/packing list/i);
    expect(result.answer).toMatch(/not a complete/i);
  });
  it("finds cameras and phones by their use, excluding camera accessories", async () => {
    const result = await askInventory(
      "Do I have anything I can use to take pictures?",
      reader,
    );
    expect(result.citations.map((i) => i.id).sort()).toEqual([
      "camera",
      "phone",
    ]);
  });
  it("finds camera accessories without returning the camera itself", async () => {
    const result = await askInventory(
      "What are my camera accessories?",
      reader,
    );
    expect(result.citations.map((i) => i.id).sort()).toEqual([
      "card",
      "lens",
      "tripod",
    ]);
    expect(result.answer).toContain("lent");
  });
  it("does not reject a packing-list edit as an inventory mutation", async () => {
    const result = await askInventory(
      "Add a camera to my camping packing list",
      reader,
    );
    expect(result.citations.map((i) => i.id)).toContain("camera");
    expect(result.answer).not.toMatch(/use the inventory editor/i);
  });
  it("passes contextual packing-list revisions to the model without mutating inventory", async () => {
    const result = await askInventory(
      "Remove the camera",
      reader,
      {
        async answer(context) {
          expect(context.history?.[0].answer).toContain("packing list");
          return {
            answer: "I left the camera off your suggested list.",
            itemIds: [],
          };
        },
      },
      [
        {
          question: "Pack me for camping",
          answer: "Your packing list: backpack and camera.",
        },
      ],
    );
    expect(result.mode).toBe("ai");
    expect(rows.find((row) => row.id === "camera")?.name).toBe(
      "Compact camera",
    );
  });
  it("uses model-selected searches even when the initial question has no literal matches", async () => {
    let calls = 0;
    const provider = createReadOnlyAnswerGraph({
      async invoke(messages) {
        calls++;
        if (calls === 1)
          return new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "lookup",
                name: "search_inventory",
                args: { query: "camera smartphone" },
              },
            ],
          });
        expect(String(messages.at(-1)?.content)).toContain("Smartphone");
        return new AIMessage(
          JSON.stringify({
            answer: "Your smartphone can capture the moment.",
            itemIds: ["phone"],
          }),
        );
      },
    });
    const result = await askInventory(
      "How can I capture a memory?",
      reader,
      provider,
    );
    expect(result.mode).toBe("ai");
    expect(result.citations.map((i) => i.id)).toEqual(["phone"]);
    expect(calls).toBe(2);
  });
  it("bounds an endless tool loop and falls back to usable results", async () => {
    let calls = 0;
    const provider = createReadOnlyAnswerGraph({
      async invoke() {
        calls++;
        return new AIMessage({
          content: "",
          tool_calls: [
            {
              id: `lookup-${calls}`,
              name: "search_inventory",
              args: { query: "backpack" },
            },
          ],
        });
      },
    });
    const result = await askInventory("backpack", reader, provider);
    expect(result.mode).toBe("search");
    expect(result.notice).toBeTruthy();
    expect(calls).toBeLessThanOrEqual(4);
    expect(calls).toBeGreaterThan(1);
  });
  it("rejects invented citations after tool execution", async () => {
    let calls = 0;
    const provider = createReadOnlyAnswerGraph({
      async invoke() {
        if (++calls === 1)
          return new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "lookup",
                name: "search_inventory",
                args: { query: "camera" },
              },
            ],
          });
        return new AIMessage(
          JSON.stringify({ answer: "You own a drone.", itemIds: ["drone"] }),
        );
      },
    });
    const result = await askInventory("camera", reader, provider);
    expect(result.mode).toBe("search");
    expect(result.answer).not.toContain("drone");
  });
});
