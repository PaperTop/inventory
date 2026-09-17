import type { Item, Location } from "./inventory";

export function ancestors(item: Item, items: readonly Item[]): Item[] {
  const byId = new Map(items.map((row) => [row.id, row]));
  const result: Item[] = [],
    seen = new Set([item.id]);
  let parentId = item.parent_container_id;
  while (parentId) {
    if (seen.has(parentId))
      throw new Error("A container cannot contain itself or an ancestor.");
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (
      !parent ||
      parent.kind !== "container" ||
      parent.user_id !== item.user_id
    )
      throw new Error("The selected container is unavailable.");
    result.unshift(parent);
    parentId = parent.parent_container_id;
  }
  return result;
}

export function resolveHierarchy<T extends Item>(
  items: readonly T[],
  locations: readonly Location[] = [],
): T[] {
  return items.map((item) => {
    const chain = ancestors(item, items),
      top = chain[0] ?? item;
    const location =
      locations.find((l) => l.id === top.location_id)?.name ??
      top.location_name;
    return {
      ...item,
      location_name: location,
      resolved_location_id: top.location_id,
      ancestor_ids: chain.map((row) => row.id),
      location_path: [
        ...(location ? [location] : []),
        ...chain.map((row) => row.name),
        item.name,
      ],
    };
  });
}

export function containerDestinations(items: readonly Item[], item?: Item) {
  return items.filter(
    (row) =>
      row.kind === "container" &&
      row.id !== item?.id &&
      !ancestors(row, items).some((parent) => parent.id === item?.id),
  );
}

export function validatePlacement(item: Item, items: readonly Item[]) {
  if (item.parent_container_id && item.location_id)
    throw new Error("Choose either a location or a container.");
  ancestors(item, items);
  if (
    item.kind !== "container" &&
    items.some((row) => row.parent_container_id === item.id)
  )
    throw new Error("Move the contents before changing this container's type.");
}
