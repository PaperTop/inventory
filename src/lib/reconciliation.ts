import { z } from "zod";
import { itemInput, statuses, type Item } from "./inventory";
export const observationInput = z
  .object({
    user_id: z.uuid(),
    item_id: z.uuid(),
    source: z.enum(["camera", "receipt", "manual"]),
    source_event_id: z.string().min(1).max(200),
    confidence: z.number().min(0).max(1),
    observed_at: z.iso.datetime(),
    base_version: z.number().int().positive(),
    proposed_patch: z
      .object({
        location_id: z.uuid().nullable().optional(),
        quantity: z.number().finite().nonnegative().optional(),
        status: z.enum(statuses).optional(),
      })
      .strict(),
  })
  .strict();
export type Observation = z.infer<typeof observationInput>;
export function reconcile(item: Item, raw: Observation) {
  const event = observationInput.parse(raw);
  if (event.user_id !== item.user_id || event.item_id !== item.id)
    throw new Error("Observation must match the item owner and identity");
  const {
    id,
    user_id,
    version,
    created_at,
    updated_at,
    location_name,
    parent_container_id,
    location_path,
    ancestor_ids,
    resolved_location_id,
    location_ancestor_ids,
    ...input
  } = item;
  void id;
  void user_id;
  void version;
  void created_at;
  void updated_at;
  void location_name;
  void location_path;
  void ancestor_ids;
  void resolved_location_id;
  void location_ancestor_ids;
  itemInput.parse({
    ...input,
    parent_container_id: parent_container_id ?? null,
    ...event.proposed_patch,
  });
  const reason =
    event.base_version !== item.version
      ? "version_conflict"
      : Date.parse(event.observed_at) < Date.parse(item.updated_at)
        ? "stale_observation"
        : event.confidence < 0.85
          ? "low_confidence"
          : "confirmation_required";
  return {
    decision: "review" as const,
    reason,
    proposedPatch: { ...event.proposed_patch },
    baseVersion: item.version,
  };
}
