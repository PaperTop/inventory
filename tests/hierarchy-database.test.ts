import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, expect, it } from "vitest";
import { createStorageFixture } from "./helpers/storage-schema";
import { itemInput, type Item } from "../src/lib/inventory";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let home: string, cabin: string, bedroom: string;
async function as(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
async function location(
  name: string,
  parent: string | null = null,
  id: string | null = null,
) {
  return (
    await db.query<{ id: string; version: number }>(
      "select * from create_inventory_location($1,$2,$3)",
      [name, parent, id],
    )
  ).rows[0];
}
async function item(
  name: string,
  place: string | null,
  parent: string | null = null,
  kind = "durable",
  requestId: string | null = null,
) {
  return (
    await db.query<{ id: string; version: number }>(
      "select * from create_inventory_item($1::jsonb,'user',$2)",
      [
        itemInput.parse({
          name,
          location_id: place,
          parent_container_id: parent,
          kind,
        }),
        requestId,
      ],
    )
  ).rows[0];
}
async function snapshot() {
  return (
    await db.query<{ inventory_snapshot: Item[] }>(
      "select inventory_snapshot()",
    )
  ).rows[0].inventory_snapshot;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  await createStorageFixture(db);
  for (const file of (await readdir("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    if (file === "202610130001_rooms_creation.sql")
      await db.query(
        "insert into items(id,user_id,name) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000777',$1,'Legacy possession')",
        [owner],
      );
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await as(owner);
  home = (await location("Home")).id;
  cabin = (await location("Cabin")).id;
  bedroom = (await location("Bedroom", home)).id;
});
afterAll(async () => {
  await db?.close();
});

it("preserves existing inventory versions and history during room migration", async () => {
  const row = (
    await db.query<{ version: number }>(
      "select version from items where id='aaaaaaaa-aaaa-4aaa-8aaa-000000000777'",
    )
  ).rows[0];
  expect(row.version).toBe(1);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from inventory_activity where item_id='aaaaaaaa-aaaa-4aaa-8aaa-000000000777'",
      )
    ).rows[0].count,
  ).toBe(1);
});

it("creates real Rooms with sibling name uniqueness and valid owner-matching parents", async () => {
  await location("Bedroom", cabin);
  await expect(location("bedroom", home)).rejects.toThrow(/unique/i);
  await expect(location("Closet", bedroom)).rejects.toThrow(/root space/i);
  await expect(
    db.query("update locations set parent_location_id=id where id=$1", [
      bedroom,
    ]),
  ).rejects.toThrow(/itself/i);
  await expect(
    db.query("update locations set parent_location_id=$1 where id=$2", [
      cabin,
      home,
    ]),
  ).rejects.toThrow(/cannot become a room/i);
});

it("retains the existing version-checked item editor and container cycle protection", async () => {
  const cabinet = await item("Cabinet", bedroom, null, "container");
  const drawer = await item("Drawer", null, cabinet.id, "container");
  const camera = await item("Camera", null, drawer.id);
  expect(
    (await snapshot()).find((row) => row.id === camera.id)?.location_path,
  ).toEqual(["Home", "Bedroom", "Cabinet", "Drawer", "Camera"]);
  const updated = await db.query<{ version: number }>(
    "select version from update_inventory_item($1,1,$2::jsonb,'user')",
    [
      cabinet.id,
      itemInput.parse({
        name: "Cabinet",
        kind: "container",
        location_id: cabin,
      }),
    ],
  );
  expect(updated.rows[0].version).toBe(2);
  expect(
    (await snapshot()).find((row) => row.id === camera.id)?.location_path,
  ).toEqual(["Cabin", "Cabinet", "Drawer", "Camera"]);
  expect(
    (
      await db.query(
        "select * from update_inventory_item($1,1,$2::jsonb,'user')",
        [
          cabinet.id,
          itemInput.parse({
            name: "Stale",
            kind: "container",
            location_id: home,
          }),
        ],
      )
    ).rows,
  ).toEqual([]);
  await expect(
    db.query("select * from update_inventory_item($1,2,$2::jsonb,'user')", [
      cabinet.id,
      itemInput.parse({
        name: "Cabinet",
        kind: "container",
        parent_container_id: drawer.id,
      }),
    ]),
  ).rejects.toThrow(/cycle/i);
});

it("keeps Room identity and increments versions when renamed", async () => {
  const room = await location("Office", home);
  const renamed = (
    await db.query<{ version: number; parent_location_id: string }>(
      "select * from rename_inventory_location($1,'Study')",
      [room.id],
    )
  ).rows[0];
  expect(renamed.version).toBe(2);
  expect(renamed.parent_location_id).toBe(home);
});

it("deduplicates Add retries and never resurrects a deleted record", async () => {
  const key = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
  expect((await item("Request camera", home, null, "durable", key)).id).toBe(
    (await item("Request camera", home, null, "durable", key)).id,
  );
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from inventory_activity where item_id=$1",
        [key],
      )
    ).rows[0].count,
  ).toBe(1);
  await expect(
    item("Different input", home, null, "durable", key),
  ).rejects.toThrow(/already used/i);
  await db.query("select delete_inventory_item($1,1,'user')", [key]);
  await expect(
    item("Request camera", home, null, "durable", key),
  ).rejects.toThrow(/already used.*deleted/i);
  const roomKey = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";
  expect((await location("Retry room", home, roomKey)).id).toBe(
    (await location("Retry room", home, roomKey)).id,
  );
  await db.query("select delete_inventory_space($1,null)", [roomKey]);
  await expect(location("Retry room", home, roomKey)).rejects.toThrow(
    /already used.*deleted/i,
  );
});

it("isolates Room creation, item placement, consumed Add keys and snapshots by owner", async () => {
  await as(other);
  const own = (await location("Other home")).id;
  await expect(location("Foreign room", home)).rejects.toThrow(/root space/i);
  await expect(item("Foreign item", home)).rejects.toThrow(/foreign key/i);
  const ownItem = await item("Other item", own);
  expect((await snapshot()).map((row) => row.id)).toEqual([ownItem.id]);
  expect(
    (await db.query("select * from inventory_creation_requests")).rows,
  ).toEqual([]);
  await as(owner);
});

it("does not install the canceled movement RPC or display-order columns", async () => {
  const result = await db.query<{ rpc: string | null; columns: number }>(
    "select to_regprocedure('public.place_inventory_entity(text,uuid,integer,uuid,uuid,uuid)')::text as rpc,(select count(*)::int from information_schema.columns where table_schema='public' and table_name in ('items','locations') and column_name='sort_order') as columns",
  );
  expect(result.rows[0]).toEqual({ rpc: null, columns: 0 });
});
