import { expect, it } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { askInventory } from "../src/lib/ask";
import { createReadOnlyAnswerGraph } from "../src/lib/answer-graph";

const camera = {
  id: "camera",
  name: "Camera",
  description: "",
  category: "Electronics",
  quantity: 1,
  unit: "pc",
  status: "active" as const,
  condition: "good" as const,
  location_name: "Bedroom",
  tags: [],
  attributes: {},
};
function providerFor(name: string, args: Record<string, unknown>) {
  let calls = 0;
  return createReadOnlyAnswerGraph({
    async invoke() {
      if (++calls === 1)
        return new AIMessage({
          content: "",
          tool_calls: [{ id: "change", name, args }],
        });
      return new AIMessage(
        JSON.stringify({
          answer: "The change is prepared.",
          itemIds: name === "update_item" ? ["camera"] : [],
        }),
      );
    },
  });
}
it("prepares a validated new item through an explicit create tool call", async () => {
  const result = await askInventory(
    "Add a tent to my inventory",
    { search: async () => [] },
    providerFor("create_item", { item: { name: "Tent", category: "Camping" } }),
  );
  expect(result).toMatchObject({
    mode: "ai",
    changes: [{ type: "create", item: { name: "Tent", category: "Camping" } }],
  });
});
it("prepares a partial update without overwriting the remaining fields", async () => {
  const result = await askInventory(
    "Rename my camera to Travel camera",
    { search: async () => [camera] },
    providerFor("update_item", {
      id: "camera",
      changes: { name: "Travel camera" },
    }),
  );
  expect(result).toMatchObject({
    changes: [
      { type: "update", id: "camera", changes: { name: "Travel camera" } },
    ],
  });
  expect(camera.name).toBe("Camera");
});
it("does not allow inventory record instructions to create items during a lookup", async () => {
  const result = await askInventory(
    "Where is my camera?",
    { search: async () => [camera] },
    providerFor("create_item", { item: { name: "Injected item" } }),
  );
  expect(result).not.toHaveProperty("changes");
  expect(result.mode).toBe("search");
});
it("does not allow a packing-list revision to modify inventory", async () => {
  const result = await askInventory(
    "Add the camera to my packing list",
    { search: async () => [camera] },
    providerFor("update_item", { id: "camera", changes: { status: "lent" } }),
  );
  expect(result).not.toHaveProperty("changes");
});
it("provides the full current description when preparing an edit to existing notes", async () => {
  const description = "Original notes ".repeat(90);
  const result = await askInventory(
    "Append waterproof to my camera notes",
    { search: async () => [{ ...camera, description }] },
    {
      async answer(context, reader) {
        expect(context.items[0].description).toBe(description);
        reader!.prepareChange!({
          type: "update",
          id: "camera",
          changes: {
            description: context.items[0].description + " waterproof",
          },
        });
        return { answer: "Prepared.", itemIds: ["camera"] };
      },
    },
  );
  expect(result.changes?.[0]).toMatchObject({
    changes: { description: description + " waterproof" },
  });
});
it.each([
  { id: "unknown", changes: { name: "Test" } },
  { id: "camera", changes: { user_id: "someone-else" } },
  { id: "camera", changes: { quantity: -1 } },
  { id: "camera", changes: { status: "disposed" } },
])("rejects invalid edits before any change is applied %#", async (args) => {
  const result = await askInventory(
    "Edit my camera",
    { search: async () => [camera] },
    providerFor("update_item", args),
  );
  expect(result).not.toHaveProperty("changes");
  expect(result.mode).toBe("search");
});
