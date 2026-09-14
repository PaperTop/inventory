import type { Item, ItemInput, Location } from "./inventory";
export interface InventoryRepository {
  list(query: string): Promise<Item[]>;
  create(input: ItemInput): Promise<Item>;
  update(id: string, version: number, input: ItemInput): Promise<Item>;
  remove(id: string, version: number): Promise<void>;
  locations(): Promise<Location[]>;
  createLocation(name: string): Promise<Location>;
}
