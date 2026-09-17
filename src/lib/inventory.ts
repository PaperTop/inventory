import { z } from "zod";
export const kinds = ["durable", "consumable", "container"] as const;
export const statuses = [
  "active",
  "stored",
  "lent",
  "lost",
  "disposed",
] as const;
export const conditions = ["new", "good", "fair", "poor", "unknown"] as const;
const quantity = z.number().finite().min(0).max(1_000_000_000);
const fields = {
  name: z.string().trim().min(1).max(160),
  kind: z.enum(kinds).default("durable"),
  description: z.string().trim().max(2000).default(""),
  category: z.string().trim().max(80).default(""),
  quantity: quantity.default(1),
  unit: z.string().trim().min(1).max(30).default("item"),
  reorder_threshold: quantity.nullable().default(null),
  location_id: z.uuid().nullable().default(null),
  parent_container_id: z.uuid().nullable().default(null),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .default([])
    .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]),
  status: z.enum(statuses).default("active"),
  condition: z.enum(conditions).default("unknown"),
  attributes: z
    .record(z.string().max(80), z.json())
    .default({})
    .refine(
      (v) => JSON.stringify(v).length <= 8000,
      "Attributes must be under 8,000 characters",
    ),
};
function durableRule(v: {
  kind: string;
  quantity: number;
  reorder_threshold: number | null;
}) {
  return (
    v.kind === "consumable" ||
    (v.quantity === 1 && v.reorder_threshold === null)
  );
}
export const itemInput = z
  .object(fields)
  .strict()
  .refine(
    durableRule,
    "Durable items and containers must have quantity 1 and no reorder threshold",
  )
  .refine(
    placementRule,
    "Choose a location or a container, not both; a root container needs a location",
  );
// Shared content validation for chat edits before placement is resolved.
// Local container IDs are session IDs; persisted placement is validated by itemInput.
export const itemContentInput = z
  .object(fields)
  .omit({
    location_id: true,
    parent_container_id: true,
  })
  .strict()
  .refine(
    durableRule,
    "Durable items and containers must have quantity 1 and no reorder threshold",
  );
export const itemUpdate = z
  .object({ ...fields, version: z.number().int().positive() })
  .strict()
  .refine(
    durableRule,
    "Durable items and containers must have quantity 1 and no reorder threshold",
  )
  .refine(
    placementRule,
    "Choose a location or a container, not both; a root container needs a location",
  );
function placementRule(v: {
  kind: string;
  location_id: string | null;
  parent_container_id?: string | null;
}) {
  return (
    !(v.location_id && v.parent_container_id) &&
    (v.kind !== "container" || Boolean(v.location_id || v.parent_container_id))
  );
}
export type ItemInput = z.output<typeof itemInput>;
export type Item = Omit<ItemInput, "parent_container_id"> & {
  id: string;
  user_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  location_name: string | null;
  parent_container_id?: string | null;
  location_path?: string[];
  ancestor_ids?: string[];
  resolved_location_id?: string | null;
};
export type Location = { id: string; user_id: string; name: string };
export const isLowStock = (i: Item) =>
  i.kind === "consumable" &&
  i.reorder_threshold !== null &&
  i.quantity <= i.reorder_threshold &&
  i.status !== "disposed";
const stopwords = new Set(
  "a an the my me i is are do does did have has what where which can you please show find for of in to and own inventory".split(
    " ",
  ),
);
export function queryTerms(query: string): string[] {
  return [
    ...new Set(
      (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
        (t) => !stopwords.has(t),
      ),
    ),
  ].slice(0, 16);
}
export function searchInventory(items: readonly Item[], query: string): Item[] {
  const terms = queryTerms(query);
  if (!terms.length) return [...items];
  return items
    .map((item) => {
      const name = item.name.toLowerCase();
      const text = [
        item.name,
        item.description,
        item.category,
        item.location_name,
        ...(item.location_path ?? []),
        ...item.tags,
        JSON.stringify(item.attributes),
      ]
        .join(" ")
        .toLowerCase();
      return {
        item,
        score: terms.reduce(
          (s, t) => s + (name.includes(t) ? 3 : text.includes(t) ? 1 : 0),
          0,
        ),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((r) => r.item);
}
