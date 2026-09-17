import { describe, it, expect } from "vitest";
import { itemInput, type Item } from "../src/lib/inventory";

describe("container input", () => {
  it("accepts a container in a location", () => {
    expect(
      itemInput.safeParse({
        name: "Cabinet",
        kind: "container",
        location_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
      }).success,
    ).toBe(true);
  });
  it("accepts an item inside a container", () => {
    expect(
      itemInput.safeParse({
        name: "Camera",
        parent_container_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
      }).success,
    ).toBe(true);
  });
  it("defaults a missing parent to a root placement", () => {
    expect(
      itemInput.parse({ name: "Notebook" }).parent_container_id,
    ).toBeNull();
  });
  it("rejects conflicting location and parent assignments", () => {
    expect(
      itemInput.safeParse({
        name: "Camera",
        location_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        parent_container_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
      }).success,
    ).toBe(false);
  });
  it("rejects a container with stock quantities", () => {
    expect(
      itemInput.safeParse({ name: "Drawer", kind: "container", quantity: 2 })
        .success,
    ).toBe(false);
  });
});

// Shared fixture for the hierarchy UI and save/reload tests.
export const bedroom = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  user_id: "11111111-1111-4111-8111-111111111111",
  name: "Bedroom",
};
export function containerFixture(): Item[] {
  const make = (
    name: string,
    n: number,
    kind: string,
    parent: string | null,
  ) => ({
    ...itemInput.parse({
      name,
      kind,
      location_id: parent ? null : bedroom.id,
      parent_container_id: parent,
    }),
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`,
    user_id: bedroom.user_id,
    version: 1,
    created_at: "2026-09-14T00:00:00Z",
    updated_at: "2026-09-14T00:00:00Z",
    location_name: "Bedroom",
  });
  const cabinet = make("Cabinet", 1, "container", null);
  const drawer = make("Drawer", 2, "container", cabinet.id);
  return [
    cabinet,
    drawer,
    make("Camera", 3, "durable", drawer.id),
    make("Notebook", 4, "durable", null),
  ];
}
