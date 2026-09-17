import type { PGlite } from "@electric-sql/pglite";

// Supabase owns this schema in production. The embedded DB models the columns
// used by our migration so real Postgres RLS can be tested without a server.
export async function createStorageFixture(db: PGlite) {
  await db.exec(`
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id), name text not null,
      unique(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, anon;
    grant select, insert, update, delete on storage.objects to authenticated, anon;
  `);
}
