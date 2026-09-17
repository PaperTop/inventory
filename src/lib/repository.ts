import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryRepository } from "./contracts";
import type { Item, ItemInput, Location } from "./inventory";
import { HttpError } from "./http";
type DbError = { code?: string; message: string } | null;
function check(error: DbError) {
  if (!error) return;
  if (error.code === "23505")
    throw new HttpError(409, "That record already exists.");
  if (error.code === "23503")
    throw new HttpError(
      400,
      "Move the contents before deleting a container, and choose an available location or container.",
    );
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
    async create(input: ItemInput) {
      const { data, error } = await client
        .from("items")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      check(error);
      return hydrate(data);
    },
    async update(id, version, input) {
      const { data, error } = await client
        .from("items")
        .update(input)
        .eq("user_id", userId)
        .eq("id", id)
        .eq("version", version)
        .select()
        .maybeSingle();
      check(error);
      if (!data) return conflict(id);
      return hydrate(data);
    },
    async remove(id, version) {
      const { data, error } = await client
        .from("items")
        .delete()
        .eq("user_id", userId)
        .eq("id", id)
        .eq("version", version)
        .select("id");
      check(error);
      if (!data?.length) await conflict(id);
    },
    async locations() {
      const { data, error } = await client
        .from("locations")
        .select("id,user_id,name")
        .eq("user_id", userId)
        .order("name");
      check(error);
      return (data ?? []) as Location[];
    },
    async createLocation(name) {
      const { data, error } = await client
        .from("locations")
        .insert({ name, user_id: userId })
        .select("id,user_id,name")
        .single();
      check(error);
      return data as Location;
    },
    async updateLocation(id, name) {
      const { data, error } = await client
        .from("locations")
        .update({ name })
        .eq("user_id", userId)
        .eq("id", id)
        .select("id,user_id,name")
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
