import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryRepository } from "./contracts";
import type { Item, ItemInput, Location } from "./inventory";
import type { ActivityActor } from "./dashboard";
import { HttpError } from "./http";
type DbError = { code?: string; message: string } | null;
function check(error: DbError) {
  if (!error) return;
  if (error.code === "40001" || error.code === "40P01")
    throw new HttpError(
      409,
      "This record changed. Reload inventory and try again.",
    );
  if (
    error.code === "23505" &&
    /locations_(?:room|root)_name/.test(error.message)
  )
    throw new HttpError(
      409,
      "A location with that name already exists in the destination space.",
    );
  if (error.code === "23505" && /Creation request.*deleted/.test(error.message))
    throw new HttpError(
      409,
      "That Add request was already completed and its record was removed. Start a new draft to add another.",
    );
  if (error.code === "23505" && /Creation request/.test(error.message))
    throw new HttpError(
      409,
      "This Add request already saved different data. Reload inventory before retrying.",
    );
  if (error.code === "23505")
    throw new HttpError(409, "That record already exists.");
  if (error.code === "23503")
    throw new HttpError(
      400,
      "Move the contents before deleting a container, and choose an available location or container.",
    );
  if (error.code === "23514" && /Remove rooms/.test(error.message))
    throw new HttpError(400, "Remove the rooms before deleting their space.");
  if (error.code === "23514" || error.code === "22P02")
    throw new HttpError(
      400,
      "Invalid placement or inventory values. A container cannot be placed inside itself or its contents.",
    );
  if (error.code === "42501")
    throw new HttpError(403, "You do not have access to this record.");
  throw new HttpError(
    503,
    "Inventory storage is unavailable. Check that the database migration has been applied.",
  );
}
export function createRepository(
  client: SupabaseClient,
  userId: string,
): InventoryRepository {
  async function hydrate(row: Omit<Item, "location_name">): Promise<Item> {
    const { data: snapshot, error: snapshotError } =
      await client.rpc("inventory_snapshot");
    check(snapshotError);
    const hydrated = (snapshot as Item[] | null)?.find(
      (item) => item.id === row.id,
    );
    if (hydrated) return hydrated;
    let location_name = null;
    if (row.location_id) {
      const { data, error } = await client
        .from("locations")
        .select("name")
        .eq("user_id", userId)
        .eq("id", row.location_id)
        .maybeSingle();
      check(error);
      location_name = data?.name ?? null;
    }
    return {
      ...row,
      quantity: Number(row.quantity),
      reorder_threshold:
        row.reorder_threshold === null ? null : Number(row.reorder_threshold),
      location_name,
    };
  }
  async function conflict(id: string): Promise<never> {
    const { data, error } = await client
      .from("items")
      .select("id")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    check(error);
    throw new HttpError(
      data ? 409 : 404,
      data
        ? "This item changed since you opened it. Refresh and try again."
        : "Item not found.",
    );
  }
  return {
    async list(query) {
      if (!query.trim()) {
        const { data, error } = await client.rpc("inventory_snapshot");
        check(error);
        return (data ?? []) as Item[];
      }
      const { data, error } = await client.rpc("search_inventory", {
        search_query: query,
        result_limit: 200,
      });
      check(error);
      return (data ?? []) as Item[];
    },
    async create(
      input: ItemInput,
      actor: ActivityActor = "user",
      requestId?: string,
    ) {
      const { data, error } = await client
        .rpc("create_inventory_item", {
          item_data: input,
          activity_actor: actor,
          request_id: requestId ?? null,
        })
        .maybeSingle();
      check(error);
      if (!data)
        throw new HttpError(
          503,
          "Inventory storage did not return the new item.",
        );
      // The insert is confirmed. A subsequent read failing must not turn this
      // into an apparent failed creation; the request ID also makes retry safe.
      try {
        return await hydrate(data as Omit<Item, "location_name">);
      } catch {
        return { ...data, location_name: null } as Item;
      }
    },
    async update(id, version, input, actor: ActivityActor = "user") {
      const { data, error } = await client
        .rpc("update_inventory_item", {
          item_id: id,
          expected_version: version,
          item_data: input,
          activity_actor: actor,
        })
        .maybeSingle();
      check(error);
      if (!data) return conflict(id);
      return hydrate(data as Omit<Item, "location_name">);
    },
    async remove(id, version, actor: ActivityActor = "user") {
      const { data, error } = await client.rpc("delete_inventory_item", {
        item_id: id,
        expected_version: version,
        activity_actor: actor,
      });
      check(error);
      if (!data) await conflict(id);
    },
    async locations() {
      const { data, error } = await client
        .from("locations")
        .select("id,user_id,name,parent_location_id,version")
        .eq("user_id", userId)
        .order("name")
        .order("id");
      check(error);
      return (data ?? []) as Location[];
    },
    async createLocation(name, parentId = null, requestId) {
      const { data, error } = await client
        .rpc("create_inventory_location", {
          location_name: name,
          parent_id: parentId,
          request_id: requestId ?? null,
        })
        .single();
      check(error);
      return data as Location;
    },
    async updateLocation(id, name) {
      const { data, error } = await client
        .rpc("rename_inventory_location", {
          location_id: id,
          location_name: name,
        })
        .maybeSingle();
      check(error);
      if (!data) throw new HttpError(404, "Space not found.");
      return data as Location;
    },
    async removeLocation(id, destinationId) {
      const { error } = await client.rpc("delete_inventory_space", {
        space_id: id,
        destination_id: destinationId,
      });
      check(error);
    },
  };
}
