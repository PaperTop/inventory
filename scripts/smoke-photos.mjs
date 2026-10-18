import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  SMOKE_EMAIL: email,
  SMOKE_PASSWORD: password,
  SMOKE_OTHER_EMAIL: otherEmail,
  SMOKE_OTHER_PASSWORD: otherPassword,
} = process.env;
if (!url || !key || !email || !password || !otherEmail || !otherPassword)
  throw new Error(
    "Configure Supabase in .env.local and two disposable confirmed accounts in .env.smoke.local: SMOKE_EMAIL/SMOKE_PASSWORD and SMOKE_OTHER_EMAIL/SMOKE_OTHER_PASSWORD (see .env.smoke.example).",
  );

const newClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const owner = newClient(),
  other = newClient(),
  fresh = newClient(),
  anonymous = newClient();
const bucket = "inventory-photos";
// A synthetic one-pixel PNG; this script never reads personal image files.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1WQAAAAASUVORK5CYII=",
  "base64",
);
const objects = [];
let itemId;
function check(result) {
  if (result.error)
    throw new Error(
      `Supabase photo check failed: ${result.error.code ?? result.error.statusCode ?? "unknown"}`,
    );
  return result.data;
}
try {
  const { user } = check(
    await owner.auth.signInWithPassword({ email, password }),
  );
  const { user: secondUser } = check(
    await other.auth.signInWithPassword({
      email: otherEmail,
      password: otherPassword,
    }),
  );
  assert.notEqual(user.id, secondUser.id, "Use two different accounts.");
  const path = `${user.id}/${randomUUID()}.png`;
  objects.push(path);
  check(
    await owner.storage
      .from(bucket)
      .upload(path, png, { contentType: "image/png", upsert: false }),
  );
  const item = check(
    await owner
      .from("items")
      .insert({
        user_id: user.id,
        name: `Photo smoke ${randomUUID()}`,
        attributes: { image_path: path },
      })
      .select()
      .single(),
  );
  itemId = item.id;

  // A new login proves the reference and object survive the originating client.
  check(await fresh.auth.signInWithPassword({ email, password }));
  const loaded = check(
    await fresh
      .from("items")
      .select("attributes,version")
      .eq("id", itemId)
      .single(),
  );
  assert.equal(loaded.attributes.image_path, path);
  const image = check(await fresh.storage.from(bucket).download(path));
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const signed = check(
    await fresh.storage.from(bucket).createSignedUrl(path, 60),
  );
  const response = await fetch(signed.signedUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);

  assert.ok((await other.storage.from(bucket).download(path)).error);
  assert.ok((await other.storage.from(bucket).createSignedUrl(path, 60)).error);
  assert.ok((await anonymous.storage.from(bucket).download(path)).error);
  const foreignPath = `${user.id}/${randomUUID()}.png`;
  objects.push(foreignPath);
  assert.ok(
    (
      await other.storage
        .from(bucket)
        .upload(foreignPath, png, { contentType: "image/png" })
    ).error,
  );
  await other.storage.from(bucket).remove([path]);
  check(await owner.storage.from(bucket).download(path));
  assert.deepEqual(
    check(await other.from("items").select("id").eq("id", itemId)),
    [],
  );

  const replacement = `${user.id}/${randomUUID()}.png`;
  objects.push(replacement);
  check(
    await owner.storage
      .from(bucket)
      .upload(replacement, png, { contentType: "image/png" }),
  );
  const changed = check(
    await owner
      .from("items")
      .update({ attributes: { image_path: replacement } })
      .eq("id", itemId)
      .eq("version", loaded.version)
      .select()
      .single(),
  );
  assert.equal(changed.version, loaded.version + 1);
  assert.deepEqual(
    check(
      await owner
        .from("items")
        .update({ attributes: { image_path: path } })
        .eq("id", itemId)
        .eq("version", loaded.version)
        .select(),
    ),
    [],
  );
  assert.equal(
    check(
      await fresh.from("items").select("attributes").eq("id", itemId).single(),
    ).attributes.image_path,
    replacement,
  );
  console.log(
    "PASS: private photo upload, fresh-session reload, download/signing, replacement, stale-save rejection, and account isolation.",
  );
} finally {
  // Only synthetic records/objects created by this invocation are removed.
  try {
    if (itemId) check(await owner.from("items").delete().eq("id", itemId));
  } finally {
    try {
      if (objects.length)
        check(await owner.storage.from(bucket).remove(objects));
    } finally {
      await Promise.all(
        [owner, other, fresh].map((client) => client.auth.signOut()),
      );
    }
  }
}
