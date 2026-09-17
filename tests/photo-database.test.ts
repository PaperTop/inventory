import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createStorageFixture } from "./helpers/storage-schema";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const object = "33333333-3333-4333-8333-333333333333";
const path = `${owner}/${object}.png`;
async function as(user: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`,
  );
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
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
});
afterAll(async () => {
  await db?.close();
});

it("creates a private bucket with format and size restrictions", async () => {
  await db.exec("reset role");
  const { rows } = await db.query(
    "select public, file_size_limit, allowed_mime_types from storage.buckets where id='inventory-photos'",
  );
  expect(rows).toEqual([
    {
      public: false,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    },
  ]);
});

it("lets owners upload and read photos, but not overwrite immutable objects", async () => {
  await as(owner);
  await db.query(
    "insert into storage.objects(bucket_id,name) values ('inventory-photos',$1)",
    [path],
  );
  expect((await db.query("select name from storage.objects")).rows).toEqual([
    { name: path },
  ]);
  expect(
    (
      await db.query(
        "update storage.objects set name=$1 where name=$2 returning name",
        [`${owner}/${object}.jpg`, path],
      )
    ).rows,
  ).toEqual([]);
});

it("blocks cross-account reads, uploads, changes, and deletes", async () => {
  await as(other);
  expect((await db.query("select * from storage.objects")).rows).toEqual([]);
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values ('inventory-photos',$1)",
      [`${owner}/${object}.webp`],
    ),
  ).rejects.toThrow(/row.level security/i);
  expect(
    (
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [path],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "update storage.objects set name=$1 where name=$2 returning name",
        [`${other}/${object}.png`, path],
      )
    ).rows,
  ).toEqual([]);
});

it("blocks malformed paths and anonymous access", async () => {
  await as(owner);
  for (const name of [
    `${owner}/../secret.png`,
    `${owner}/${object}.svg`,
    `${owner}/photo.png`,
  ])
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values ('inventory-photos',$1)",
        [name],
      ),
    ).rejects.toThrow(/row.level security/i);
  await db.exec("reset role; set role anon");
  expect((await db.query("select * from storage.objects")).rows).toEqual([]);
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values ('inventory-photos',$1)",
      [`${owner}/${object}.jpg`],
    ),
  ).rejects.toThrow(/row.level security/i);
});
