import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createStorageFixture } from "./helpers/storage-schema";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const bedroom = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const living = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";

async function as(user: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`,
  );
}

function input(
  name: string,
  locationId: string | null,
  extra: Record<string, unknown> = {},
) {
  return {
    name,
    kind: "durable",
    description: "",
    category: "Photography",
    quantity: 1,
    unit: "item",
    reorder_threshold: null,
    location_id: locationId,
    parent_container_id: null,
    tags: [],
    status: "active",
    condition: "good",
    attributes: {},
    ...extra,
  };
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  await createStorageFixture(db);
  for (const file of (await readdir("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await as(owner);
  await db.query(
    "insert into public.locations(id,user_id,name) values ($1,$3,'Bedroom'),($2,$3,'Living Room')",
    [bedroom, living, owner],
  );
});

afterAll(async () => {
  await db?.close();
});

it("records real item mutations with owning rooms and requested actors", async () => {
  const created = await db.query<{ id: string; version: number }>(
    "select id,version from public.create_inventory_item($1::jsonb,'jarvis')",
    [input("Camera", bedroom)],
  );
  const id = created.rows[0].id;
  await db.query(
    "select * from public.update_inventory_item($1,1,$2::jsonb,'user')",
    [id, input("Camera", living, { tags: ["travel"] })],
  );
  const { rows } = await db.query<{
    kind: string;
    actor: string;
    room_name: string;
    detail: string;
  }>(
    "select kind,actor,room_name,detail from public.inventory_activity where item_id=$1 order by occurred_at,id",
    [id],
  );
  expect(rows).toEqual([
    {
      kind: "created",
      actor: "jarvis",
      room_name: "Bedroom",
      detail: "Added",
    },
    {
      kind: "moved",
      actor: "user",
      room_name: "Living Room",
      detail: "Moved to Living Room",
    },
  ]);
});

it("resolves a nested item's owning room when capturing activity", async () => {
  const container = await db.query<{ id: string }>(
    "select id from public.create_inventory_item($1::jsonb,'user')",
    [input("Drawer", bedroom, { kind: "container", category: "" })],
  );
  const child = await db.query<{ id: string }>(
    "select id from public.create_inventory_item($1::jsonb,'user')",
    [
      input("SD card", null, {
        parent_container_id: container.rows[0].id,
      }),
    ],
  );
  expect(
    (
      await db.query<{ room_name: string }>(
        "select room_name from public.inventory_activity where item_id=$1 order by occurred_at desc,id desc limit 1",
        [child.rows[0].id],
      )
    ).rows[0].room_name,
  ).toBe("Bedroom");
});

it("preserves a truthful snapshot after deletion", async () => {
  const created = await db.query<{ id: string }>(
    "select id from public.create_inventory_item($1::jsonb,'user')",
    [input("Old tripod", bedroom)],
  );
  const id = created.rows[0].id;
  expect(
    (
      await db.query<{ delete_inventory_item: boolean }>(
        "select public.delete_inventory_item($1,1,'user')",
        [id],
      )
    ).rows[0].delete_inventory_item,
  ).toBe(true);
  expect(
    (
      await db.query(
        "select item_id,item_name,kind,room_name from public.inventory_activity where item_id=$1 order by occurred_at desc,id desc limit 1",
        [id],
      )
    ).rows[0],
  ).toEqual({
    item_id: id,
    item_name: "Old tripod",
    kind: "deleted",
    room_name: "Bedroom",
  });
});

it("isolates activity and visit state by account", async () => {
  await db.query(
    "select public.ack_inventory_dashboard_visit('2026-09-19T00:00:00Z')",
  );
  const visits = (
    await db.query<{ user_id: string; last_visited_at: Date }>(
      "select * from public.inventory_dashboard_visits",
    )
  ).rows;
  expect(visits[0].user_id).toBe(owner);
  expect(visits[0].last_visited_at.toISOString()).toBe(
    "2026-09-19T00:00:00.000Z",
  );
  await db.query(
    "select public.ack_inventory_dashboard_visit('2026-09-18T00:00:00Z')",
  );
  expect(
    (
      await db.query<{ last_visited_at: Date }>(
        "select last_visited_at from public.inventory_dashboard_visits",
      )
    ).rows[0].last_visited_at.toISOString(),
  ).toBe("2026-09-19T00:00:00.000Z");
  await expect(
    db.query(
      "select public.ack_inventory_dashboard_visit('2999-01-01T00:00:00Z')",
    ),
  ).rejects.toThrow(/visit time/i);
  await expect(
    db.query(
      "insert into public.inventory_activity(user_id,item_version,item_name,kind,actor,room_name) values ($1,1,'Fake','created','user','Bedroom')",
      [owner],
    ),
  ).rejects.toThrow(/permission denied/i);
  await as(other);
  expect(
    (await db.query("select * from public.inventory_activity")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from public.inventory_dashboard_visits")).rows,
  ).toEqual([]);
});
