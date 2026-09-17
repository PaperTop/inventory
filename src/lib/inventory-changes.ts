import { z } from "zod";
import {
  conditions,
  itemContentInput,
  type Item,
  type Location,
} from "./inventory";
import { validatePlacement, resolveHierarchy } from "./containers";

const editableFields = {
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(80).optional(),
  quantity: z.number().finite().min(0).max(1_000_000_000).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  status: z.enum(["active", "stored", "lent", "lost"]).optional(),
  condition: z.enum(conditions).optional(),
  location: z.string().trim().min(1).max(160).optional(),
};
export const createItemArguments = z
  .object({
    item: z
      .object({
        ...editableFields,
        name: z.string().trim().min(1).max(160),
        kind: z.enum(["durable", "consumable"]).optional(),
      })
      .strict(),
  })
  .strict();
export const updateItemArguments = z
  .object({
    id: z.string().min(1).max(160),
    changes: z
      .object(editableFields)
      .strict()
      .refine(
        (value) => Object.keys(value).length > 0,
        "At least one field must change",
      ),
  })
  .strict();
export const inventoryChangeInput = z.discriminatedUnion("type", [
  createItemArguments.extend({ type: z.literal("create") }),
  updateItemArguments.extend({ type: z.literal("update") }),
]);
export type InventoryChange = z.output<typeof inventoryChangeInput>;
export type ChangeOutcome = { items: Item[]; summary: string; error?: string };

// Tool availability is decided from the user's request, never record contents.
// Actual validation and saving happen through the existing inventory store.
export function requestsInventoryChange(
  question: string,
  history: { question: string; answer: string }[] = [],
) {
  if (
    /\b(?:packing|shopping|suggested|camping) list\b|\b(?:trip|packing) plan\b/i.test(
      question,
    ) &&
    !/\b(?:inventory|database)\b/i.test(question)
  )
    return false;
  if (/\b(?:how (?:do|can|would|to)|explain|example)\b/i.test(question))
    return false;
  const write =
    /\b(?:add|create|record|register|rename|edit|update|change|set|tag|mark|move|put|append)\b/i;
  if (write.test(question)) {
    // A bare "add/remove X" after packing advice revises the suggested list.
    let planning = false;
    for (const turn of history) {
      if (/\bpack(?:ing)?\b/i.test(turn.question)) planning = true;
      if (/\binventory\b/i.test(turn.question) && write.test(turn.question))
        planning = false;
    }
    if (
      planning &&
      /^(?:please )?(?:add|remove)\b/i.test(question) &&
      !/\binventory\b/i.test(question)
    )
      return false;
    return true;
  }
  // A short answer can complete Jarvis's clarification of an explicit edit.
  const previous = history.at(-1);
  return Boolean(
    previous &&
    write.test(previous.question) &&
    /\?\s*$/.test(previous.answer) &&
    !/\b(?:pack(?:ing)?|list)\b/i.test(previous.question),
  );
}

export function prepareInventoryChanges(
  rawChanges: unknown,
  items: readonly Item[],
  locations: readonly Location[],
  placeNames: readonly string[],
  expectedVersions: Readonly<Record<string, number>>,
): { type: "create" | "update"; item: Item }[] {
  const changes = z.array(inventoryChangeInput).min(1).max(5).parse(rawChanges);
  let working = [...items];
  const updated = new Set<string>();
  return changes.map((change) => {
    const previous =
      change.type === "update"
        ? working.find((item) => item.id === change.id)
        : undefined;
    if (change.type === "update") {
      if (!previous)
        throw new Error("That item no longer exists. Ask Jarvis again.");
      if (updated.has(change.id))
        throw new Error("An item can only be edited once per request.");
      if (expectedVersions[change.id] !== previous.version)
        throw new Error(
          `${previous.name} changed while Jarvis was answering. Ask again with the latest inventory.`,
        );
      updated.add(change.id);
    }
    const { location, ...patch } =
      change.type === "create" ? change.item : change.changes;
    const content = itemContentInput.parse({
      ...(previous
        ? {
            name: previous.name,
            kind: previous.kind,
            description: previous.description,
            category: previous.category,
            quantity: previous.quantity,
            unit: previous.unit,
            reorder_threshold: previous.reorder_threshold,
            tags: previous.tags,
            status: previous.status,
            condition: previous.condition,
            attributes: previous.attributes,
          }
        : {}),
      ...patch,
    });
    let location_id = previous?.location_id ?? null;
    let location_name = previous?.location_name ?? null;
    let parent_container_id = previous?.parent_container_id ?? null;
    if (location !== undefined) {
      const sameName = (name: string) =>
        name.toLowerCase() === location.toLowerCase();
      const containers = working.filter(
        (item) => item.kind === "container" && sameName(item.name),
      );
      const places = [
        ...new Set([...placeNames, ...locations.map((place) => place.name)]),
      ].filter(sameName);
      if (containers.length + places.length !== 1)
        throw new Error(
          `The location “${location}” is missing or ambiguous. Choose an existing place or a uniquely named container.`,
        );
      const parent = containers[0];
      parent_container_id = parent?.id ?? null;
      location_id = parent
        ? null
        : (locations.find((place) => sameName(place.name))?.id ?? null);
      location_name = parent?.location_name ?? places[0];
    }
    const now = new Date().toISOString();
    const next: Item = {
      ...previous,
      ...content,
      id: previous?.id ?? crypto.randomUUID(),
      user_id: previous?.user_id ?? items[0]?.user_id ?? "local",
      location_id,
      location_name,
      parent_container_id,
      version: (previous?.version ?? 0) + 1,
      created_at: previous?.created_at ?? now,
      updated_at: now,
    };
    validatePlacement(next, working);
    working = previous
      ? working.map((item) => (item.id === previous.id ? next : item))
      : [...working, next];
    working = resolveHierarchy(working, [...locations]);
    return {
      type: change.type,
      item: working.find((item) => item.id === next.id)!,
    };
  });
}
