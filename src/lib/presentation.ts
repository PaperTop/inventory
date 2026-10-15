import { isLowStock, searchInventory, type Item } from "./inventory";

export function buildInventorySlots(items: Item[], _minimum: number) {
  const minimum = Math.max(0, Math.floor(_minimum));
  if (items.length >= minimum) return items;
  return [...items, ...Array<null>(minimum - items.length).fill(null)];
}

export type InventoryViewOptions = {
  query: string;
  kind: "all" | "durable" | "consumable" | "container" | "low";
  location: string;
  sort: "recent" | "name" | "quantity";
};

export function filterInventory(
  items: readonly Item[],
  options: InventoryViewOptions,
) {
  const searched = searchInventory(items, options.query);
  const filtered = searched.filter((item) => {
    const kindMatches =
      options.kind === "all" ||
      (options.kind === "low" ? isLowStock(item) : item.kind === options.kind);
    const locationMatches =
      options.location === "all" ||
      item.location_name === options.location ||
      item.resolved_location_id === options.location ||
      item.location_id === options.location ||
      item.location_ancestor_ids?.includes(options.location);
    return kindMatches && locationMatches;
  });

  return sortInventory(filtered, options.sort);
}

export function sortInventory<T extends Item>(
  items: readonly T[],
  sort: InventoryViewOptions["sort"],
) {
  return [...items].sort((left, right) => {
    const containerOrder =
      Number(right.kind === "container") - Number(left.kind === "container");
    if (containerOrder) return containerOrder;
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "quantity") return right.quantity - left.quantity;
    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  });
}

export function duplicateInventoryItem(
  item: Item,
  id: string,
  timestamp: string,
): Item {
  return {
    ...item,
    id,
    name: `${item.name} copy`,
    tags: [...item.tags],
    attributes: structuredClone(item.attributes),
    version: 1,
    created_at: timestamp,
    updated_at: timestamp,
  };
}
