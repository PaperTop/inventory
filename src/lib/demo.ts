import { itemInput, searchInventory, type Item } from "./inventory";
import type { InventoryRepository } from "./contracts";
import { HttpError } from "./http";
export function demoRepository(): InventoryRepository {
  const user_id = "11111111-1111-4111-8111-111111111111";
  const locations = ["Bedroom", "Backpack", "Kitchen", "Bathroom"].map(
    (name, index) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`,
      user_id,
      name,
    }),
  );
  const seeds = [
    {
      name: "Everyday backpack",
      category: "Everyday carry",
      location_id: locations[0].id,
      tags: ["travel", "daily"],
      description: "Olive canvas backpack. Room for the essentials.",
      attributes: { color: "Olive" },
    },
    {
      name: "USB-C charger",
      category: "Electronics",
      location_id: locations[1].id,
      tags: ["travel", "usb-c"],
      description: "65W charger for laptop and phone.",
    },
    {
      name: "Winter jacket",
      category: "Clothing",
      location_id: locations[0].id,
      tags: ["winter", "travel"],
      description: "Warm, water-resistant outer layer.",
    },
    {
      name: "Coffee beans",
      category: "Pantry",
      kind: "consumable",
      quantity: 0.2,
      unit: "kg",
      reorder_threshold: 0.25,
      location_id: locations[2].id,
      tags: ["coffee"],
      description: "Medium roast, whole bean.",
    },
    {
      name: "Daily notebook",
      category: "Everyday carry",
      location_id: locations[1].id,
      tags: ["work"],
      description: "Ideas, notes, and things to remember.",
    },
    {
      name: "Shampoo",
      category: "Personal care",
      kind: "consumable",
      quantity: 1,
      unit: "bottle",
      reorder_threshold: 1,
      location_id: locations[3].id,
      tags: ["bathroom"],
    },
    {
      name: "Contact lenses",
      category: "Personal care",
      location_id: locations[3].id,
      tags: ["vision", "daily"],
      description: "Daily disposable contact lenses.",
    },
  ];
  let items: Item[] = seeds.map((seed, index) => ({
    ...itemInput.parse({ ...seed, condition: "good" }),
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
    user_id,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    location_name:
      locations.find((l) => l.id === seed.location_id)?.name ?? null,
  }));
  function row(id: string, version: number) {
    const item = items.find((i) => i.id === id);
    if (!item) throw new HttpError(404, "Item not found.");
    if (item.version !== version)
      throw new HttpError(409, "Item changed. Refresh and try again.");
    return item;
  }
  return {
    list: async (q) => structuredClone(searchInventory(items, q)),
    create: async (input) => {
      const item = {
        ...itemInput.parse(input),
        id: crypto.randomUUID(),
        user_id,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        location_name:
          locations.find((l) => l.id === input.location_id)?.name ?? null,
      };
      items = [item, ...items];
      return structuredClone(item);
    },
    update: async (id, version, input) => {
      const item = row(id, version);
      const next = {
        ...item,
        ...itemInput.parse(input),
        version: version + 1,
        updated_at: new Date().toISOString(),
        location_name:
          locations.find((l) => l.id === input.location_id)?.name ?? null,
      };
      items = items.map((i) => (i.id === id ? next : i));
      return structuredClone(next);
    },
    remove: async (id, version) => {
      row(id, version);
      items = items.filter((i) => i.id !== id);
    },
    locations: async () => structuredClone(locations),
    createLocation: async (name) => {
      if (locations.some((l) => l.name.toLowerCase() === name.toLowerCase()))
        throw new Error("That location already exists.");
      const location = { id: crypto.randomUUID(), user_id, name };
      locations.push(location);
      return structuredClone(location);
    },
    updateLocation: async (id, name) => {
      const location = locations.find((row) => row.id === id);
      if (!location) throw new HttpError(404, "Space not found.");
      if (
        locations.some(
          (row) =>
            row.id !== id && row.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new HttpError(409, "That space already exists.");
      location.name = name;
      items = items.map((item) =>
        item.location_id === id ? { ...item, location_name: name } : item,
      );
      return structuredClone(location);
    },
    removeLocation: async (id, destinationId) => {
      const index = locations.findIndex((row) => row.id === id);
      if (index < 0) throw new HttpError(404, "Space not found.");
      const destination = locations.find((row) => row.id === destinationId);
      if (
        id === destinationId ||
        (destinationId && !destination) ||
        (!destination && items.some((item) => item.location_id === id))
      )
        throw new HttpError(400, "Choose another space.");
      items = items.map((item) =>
        item.location_id === id
          ? {
              ...item,
              location_id: destinationId,
              location_name: destination?.name ?? null,
              version: item.version + 1,
              updated_at: new Date().toISOString(),
            }
          : item,
      );
      locations.splice(index, 1);
    },
  };
}
