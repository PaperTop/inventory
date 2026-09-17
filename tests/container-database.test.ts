import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { createStorageFixture } from "./helpers/storage-schema";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const room = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  garage = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";
async function as(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${owner}'),('${other}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  await createStorageFixture(db);
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await as(owner);
  await db.query(
    "insert into locations(id,user_id,name) values ($1,$3,'Bedroom'),($2,$3,'Garage')",
    [room, garage, owner],
  );
});
afterAll(async () => {
  await db?.close();
});
it("deletes a space atomically while preserving nested items and owner boundaries", async () => {
  const source = "aaaaaaaa-aaaa-4aaa-8aaa-000000000003";
  await db.query(
    "insert into locations(id,user_id,name) values ($1,$2,'Temporary room')",
    [source, owner],
  );
  const box = await insert("Moving box");
  const child = await insert("Keep this", "durable", box);
  await db.query("update items set location_id=$1 where id=$2", [source, box]);
  await expect(
    db.query("select delete_inventory_space($1,null)", [source]),
  ).rejects.toThrow(/destination/i);
  await expect(
    db.query("select delete_inventory_space($1,$1)", [source]),
  ).rejects.toThrow(/another/i);
  await as(other);
  await expect(
    db.query("select delete_inventory_space($1,$2)", [source, garage]),
  ).rejects.toThrow(/unavailable/i);
  await as(owner);
  await db.query("select delete_inventory_space($1,$2)", [source, garage]);
  expect(
    (await db.query("select id from locations where id=$1", [source])).rows,
  ).toEqual([]);
  const snapshot = (
    await db.query<{
      inventory_snapshot: { id: string; location_path: string[] }[];
    }>("select inventory_snapshot() ")
  ).rows[0].inventory_snapshot;
  expect(snapshot.find((item) => item.id === child)?.location_path).toEqual([
    "Garage",
    "Moving box",
    "Keep this",
  ]);
});
async function insert(
  name: string,
  kind = "container",
  parent: string | null = null,
) {
  const result = await db.query<{ id: string }>(
    "insert into items(user_id,name,kind,location_id,parent_container_id) values ($1,$2,$3,$4,$5) returning id",
    [owner, name, kind, parent ? null : room, parent],
  );
  return result.rows[0].id;
}
it("persists nested contents, derives paths after reload, and moves the entire subtree", async () => {
  const cabinet = await insert("Cabinet"),
    drawer = await insert("Drawer", "container", cabinet),
    camera = await insert("Camera", "durable", drawer);
  const snapshot = async () =>
    (
      await db.query<{
        inventory_snapshot: {
          id: string;
          location_name: string;
          location_path: string[];
        }[];
      }>("select inventory_snapshot()")
    ).rows[0].inventory_snapshot;
  expect(
    (await snapshot()).find((i) => i.id === camera)?.location_path,
  ).toEqual(["Bedroom", "Cabinet", "Drawer", "Camera"]);
  await db.query("update items set location_id=$1 where id=$2", [
    garage,
    cabinet,
  ]);
  expect((await snapshot()).find((i) => i.id === camera)).toMatchObject({
    location_name: "Garage",
    location_path: ["Garage", "Cabinet", "Drawer", "Camera"],
  });
  const found = await db.query<{ search_inventory: { id: string } }>(
    "select search_inventory('garage',200)",
  );
  expect(found.rows.map((r) => r.search_inventory.id)).toContain(camera);
  await expect(
    db.query(
      "update items set parent_container_id=$1,location_id=null where id=$2",
      [drawer, cabinet],
    ),
  ).rejects.toThrow(/cycle/i);
  await expect(
    db.query("delete from items where id=$1", [drawer]),
  ).rejects.toThrow(/foreign key/i);
  await expect(
    db.query("update items set kind='durable' where id=$1", [drawer]),
  ).rejects.toThrow(/container/i);
});
it("rejects self-parenting, non-container parents, and contradictory placement", async () => {
  const item = await insert("Loose camera", "durable"),
    box = await insert("Box");
  await expect(
    db.query(
      "update items set parent_container_id=id,location_id=null where id=$1",
      [box],
    ),
  ).rejects.toThrow(/cycle|itself/i);
  await expect(insert("Lens", "durable", item)).rejects.toThrow(/container/i);
  await expect(
    db.query("update items set parent_container_id=$1 where id=$2", [
      box,
      item,
    ]),
  ).rejects.toThrow(/location|placement|check/i);
});
it("protects parents and snapshots across owners and denies anonymous access", async () => {
  const box = await insert("Private box");
  await as(other);
  try {
    expect(
      (
        await db.query<{ inventory_snapshot: unknown[] }>(
          "select inventory_snapshot()",
        )
      ).rows[0].inventory_snapshot,
    ).toEqual([]);
    await expect(
      db.query(
        "insert into items(user_id,name,parent_container_id) values ($1,'Foreign child',$2)",
        [other, box],
      ),
    ).rejects.toThrow(/container|foreign key/i);
    await db.exec("reset role; set role anon");
    await expect(db.query("select inventory_snapshot()")).rejects.toThrow(
      /permission denied/i,
    );
  } finally {
    await as(owner);
  }
});
