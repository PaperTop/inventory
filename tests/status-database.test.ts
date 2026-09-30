import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createStorageFixture } from "./helpers/storage-schema";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const legacyItem = "22222222-2222-4222-8222-222222222222";
const migration = "202609190001_remove_lost_status.sql";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  await createStorageFixture(db);
  for (const file of (await readdir("supabase/migrations"))
    .filter((file) => file.endsWith(".sql") && file < migration)
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query(
    "insert into public.items(id,user_id,name,status) values ($1,$2,'Legacy missing item','lost')",
    [legacyItem, owner],
  );
  await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
  await db.exec(
    `select set_config('request.jwt.claim.sub','${owner}',false); set role authenticated;`,
  );
});

afterAll(async () => {
  await db?.close();
});

it("converts legacy lost items to active without deleting them", async () => {
  const { rows } = await db.query<{
    id: string;
    name: string;
    status: string;
    version: number;
  }>("select id,name,status,version from public.items where id=$1", [
    legacyItem,
  ]);
  expect(rows).toEqual([
    {
      id: legacyItem,
      name: "Legacy missing item",
      status: "active",
      version: 2,
    },
  ]);
});

it.each(["active", "stored", "lent", "disposed"])(
  "allows the remaining database status %s",
  async (status) => {
    await expect(
      db.query(
        "insert into public.items(user_id,name,status) values ($1,$2,$3)",
        [owner, `Status ${status}`, status],
      ),
    ).resolves.toBeDefined();
  },
);

it("rejects the removed lost status in the database", async () => {
  await expect(
    db.query(
      "insert into public.items(user_id,name,status) values ($1,'Rejected status','lost')",
      [owner],
    ),
  ).rejects.toThrow(/check constraint/i);
});
