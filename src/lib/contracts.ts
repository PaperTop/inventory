import type { Item, ItemInput, Location } from "./inventory";
import type { ActivityActor } from "./dashboard";
export interface InventoryRepository {
  list(query: string): Promise<Item[]>;
  create(
    input: ItemInput,
    actor?: ActivityActor,
    requestId?: string,
  ): Promise<Item>;
  update(
    id: string,
    version: number,
    input: ItemInput,
    actor?: ActivityActor,
  ): Promise<Item>;
  remove(id: string, version: number, actor?: ActivityActor): Promise<void>;
  locations(): Promise<Location[]>;
  createLocation(
    name: string,
    parentId?: string | null,
    requestId?: string,
  ): Promise<Location>;
  updateLocation(id: string, name: string): Promise<Location>;
  removeLocation(id: string, destinationId: string | null): Promise<void>;
}
