import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  SMOKE_EMAIL: email,
  SMOKE_PASSWORD: password,
} = process.env;
if (!url || !key || !email || !password)
  throw new Error(
    "Configure Supabase URL/public key and a disposable confirmed SMOKE_EMAIL/SMOKE_PASSWORD in .env.local.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let itemId, locationId;
function check(result) {
  if (result.error)
    throw new Error(
      `Supabase operation failed: ${result.error.code ?? "unknown"}`,
    );
  return result.data;
}
try {
  const { user } = check(
    await client.auth.signInWithPassword({ email, password }),
  );
  assert.ok(user);
  const name = `Inventory smoke ${randomUUID()}`;
  const location = check(
    await client
      .from("locations")
      .insert({ user_id: user.id, name })
      .select()
      .single(),
  );
  locationId = location.id;
  const item = check(
    await client
      .from("items")
      .insert({
        user_id: user.id,
        name,
        location_id: locationId,
        kind: "consumable",
        quantity: 1.5,
        unit: "kg",
      })
      .select()
      .single(),
  );
  itemId = item.id;
  assert.equal(Number(item.quantity), 1.5);
  const matches = check(
    await client.rpc("search_inventory", {
      search_query: name,
      result_limit: 200,
    }),
  );
  assert.ok(matches.some((row) => row.id === itemId));
  const updated = check(
    await client
      .from("items")
      .update({ quantity: 2 })
      .eq("id", itemId)
      .eq("version", 1)
      .select()
      .single(),
  );
  assert.equal(updated.version, 2);
  const stale = check(
    await client
      .from("items")
      .update({ quantity: 10 })
      .eq("id", itemId)
      .eq("version", 1)
      .select(),
  );
  assert.equal(stale.length, 0);
  console.log(
    "PASS: real Supabase Auth, create, search RPC, versioned update, and stale-write rejection.",
  );
} finally {
  if (itemId) check(await client.from("items").delete().eq("id", itemId));
  if (locationId)
    check(await client.from("locations").delete().eq("id", locationId));
  await client.auth.signOut();
}
