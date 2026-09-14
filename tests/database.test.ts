import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
let db: PGlite;
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const location = "33333333-3333-4333-8333-333333333333",
  item = "44444444-4444-4444-8444-444444444444";
async function as(user: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${a}'),('${b}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;`,
  );
  await db.exec(
    await readFile("supabase/migrations/202609130001_inventory.sql", "utf8"),
  );
  await as(a);
  await db.query(
    "insert into public.locations(id,user_id,name) values ($1,$2,$3)",
    [location, a, "Closet"],
  );
  await db.query(
    "insert into public.items(id,user_id,name,location_id,tags) values ($1,$2,$3,$4,$5)",
    [item, a, "Winter jacket", location, ["winter"]],
  );
});
afterAll(async () => {
  await db?.close();
});
describe("actual Postgres ownership policies", () => {
  it("hides all foreign inventory and locations", async () => {
    await as(b);
    expect((await db.query("select * from public.items")).rows).toEqual([]);
    expect((await db.query("select * from public.locations")).rows).toEqual([]);
  });
  it("blocks owner spoofing", async () => {
    await as(b);
    await expect(
      db.query("insert into public.items(user_id,name) values ($1,$2)", [
        a,
        "Stolen",
      ]),
    ).rejects.toThrow(/row.level security/i);
  });
  it("blocks foreign location references", async () => {
    await as(b);
    await expect(
      db.query(
        "insert into public.items(user_id,name,location_id) values ($1,$2,$3)",
        [b, "Charger", location],
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("cannot update or delete another owner item", async () => {
    await as(b);
    expect(
      (
        await db.query(
          "update public.items set name=$1 where id=$2 returning id",
          ["Changed", item],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query("delete from public.items where id=$1 returning id", [
          item,
        ])
      ).rows,
    ).toEqual([]);
  });
  it("searches only the authenticated inventory", async () => {
    await as(a);
    expect(
      (
        await db.query("select * from public.search_inventory($1,$2)", [
          "winter",
          20,
        ])
      ).rows,
    ).toHaveLength(1);
    await as(b);
    expect(
      (
        await db.query("select * from public.search_inventory($1,$2)", [
          "winter",
          20,
        ])
      ).rows,
    ).toEqual([]);
  });
  it("increments version and blocks stale edits", async () => {
    await as(a);
    const result = await db.query<{ version: number }>(
      "update public.items set condition=$1 where id=$2 and version=1 returning version",
      ["fair", item],
    );
    expect(result.rows[0].version).toBe(2);
    expect(
      (
        await db.query(
          "update public.items set name=$1 where id=$2 and version=1 returning id",
          ["Old", item],
        )
      ).rows,
    ).toEqual([]);
  });
  it("enforces quantities even outside the application", async () => {
    await as(a);
    await expect(
      db.query(
        "insert into public.items(user_id,name,kind,quantity) values ($1,$2,$3,$4)",
        [a, "Rice", "consumable", -1],
      ),
    ).rejects.toThrow(/check constraint/i);
    await expect(
      db.query(
        "insert into public.items(user_id,name,quantity) values ($1,$2,$3)",
        [a, "Laptop", 2],
      ),
    ).rejects.toThrow(/check constraint/i);
  });
  it("stores immutable deduplicated observations, not inventory updates", async () => {
    await as(a);
    await db.query(
      "insert into public.inventory_observations(user_id,item_id,source,source_event_id,confidence,base_version,proposed_patch) values ($1,$2,$3,$4,$5,$6,$7)",
      [a, item, "camera", "event1", 0.8, 2, { status: "stored" }],
    );
    await expect(
      db.query(
        "insert into public.inventory_observations(user_id,item_id,source,source_event_id,confidence,base_version) values ($1,$2,$3,$4,$5,$6)",
        [a, item, "camera", "event1", 0.8, 2],
      ),
    ).rejects.toThrow(/unique constraint/i);
    await expect(
      db.query("update public.inventory_observations set confidence=1"),
    ).rejects.toThrow(/permission denied/i);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.items where id=$1",
          [item],
        )
      ).rows[0].status,
    ).toBe("active");
    await as(b);
    expect(
      (await db.query("select * from public.inventory_observations")).rows,
    ).toEqual([]);
  });
  it("denies anonymous database reads", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from public.items")).rejects.toThrow(
      /permission denied/i,
    );
  });
});
