import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// No account, cookies, API keys or real inventory. Two model-backed requests;
// no automatic retries, database writes or environment-file loading.
export async function runDeployedSmoke({
  url,
  expectedRelease = "",
  fetchImpl = fetch,
}) {
  const base = new URL(url);
  assert(
    base.protocol === "https:" ||
      (base.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(base.hostname)),
    "Use HTTPS or a local loopback server.",
  );
  assert(
    !base.username && !base.password,
    "Do not put credentials in the smoke URL.",
  );
  const origin = base.origin;
  const request = async (path, body) => {
    const response = await fetchImpl(new URL(path, origin), {
      method: body ? "POST" : "GET",
      headers: body ? { origin, "content-type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(35_000),
    });
    assert.equal(
      response.status,
      200,
      `${path} returned HTTP ${response.status}`,
    );
    return response.json();
  };
  const metadata = await request("/api/ask/local");
  assert.equal(
    metadata.mode,
    "ai",
    "Deployed demo AI is not enabled/configured.",
  );
  if (expectedRelease)
    assert.equal(
      metadata.release,
      expectedRelease,
      "The smoke target is not serving the expected release.",
    );
  const locations = [
    { id: "smoke-home", name: "Smoke home", user_id: "local" },
    {
      id: "smoke-room",
      name: "Bedroom",
      user_id: "local",
      parent_location_id: "smoke-home",
    },
  ];
  const items = [
    ["Backpack", "Bags"],
    ["Water bottle", "Everyday carry"],
    ["Tent", "Camping"],
    ["Sleeping bag", "Camping"],
    ["Tripod", "Photography"],
    ...Array.from({ length: 34 }, (_, i) => [`Desk decoration ${i}`, "Decor"]),
  ].map(([name, category], i) => ({
    id: `release-smoke-${i}`,
    name,
    category,
    description: "",
    quantity: 1,
    unit: "pc",
    status: "active",
    condition: "good",
    tags: [],
    attributes: {},
    resolved_location_id: i % 2 ? "smoke-room" : "smoke-home",
    location_name: i % 2 ? "Smoke home → Bedroom" : "Smoke home",
  }));
  const ask = async (question, history = []) => {
    const result = await request("/api/ask/local", {
      question,
      history,
      items,
      locations,
    });
    assert.equal(typeof result.answer, "string", "Missing answer.");
    assert(Array.isArray(result.citations), "Missing citation array.");
    assert(
      result.citations.every((item) => items.some((row) => row.id === item.id)),
      "Unretrieved fixture citation.",
    );
    assert(
      !result.changes?.length,
      "Read-only smoke request returned inventory changes.",
    );
    return result;
  };
  const greeting = await ask("hi");
  assert.equal(
    greeting.conversational,
    true,
    "Greeting did not use the conversational path.",
  );
  assert.equal(
    greeting.citations.length,
    0,
    "Greeting returned inventory cards.",
  );
  const contents = await ask("Show all items in Smoke home");
  assert.equal(
    contents.inventoryResult?.complete,
    true,
    "Location result is incomplete.",
  );
  assert.equal(
    contents.inventoryResult.total,
    items.length,
    "Nested location items are missing.",
  );
  assert.deepEqual(
    contents.inventoryResult.items.map((item) => item.id).sort(),
    items.map((item) => item.id).sort(),
    "Location query was truncated or duplicated.",
  );
  const question =
    "Help me pack for camping at Lake Tahoe for 2 nights, car camping with a tent, cold weather. Give me a basic list.";
  const packing = await ask(question);
  assert.equal(packing.mode, "ai", "Packing fell back instead of using AI.");
  assert(packing.citations.length > 0, "Packing did not cite current records.");
  const followUp = await ask(
    "Actually make that 3 nights and leave out the tripod.",
    [{ question, answer: packing.answer }],
  );
  assert.equal(
    followUp.mode,
    "ai",
    "Packing follow-up fell back instead of using AI.",
  );
  assert(
    !followUp.citations.some((item) => item.id === "release-smoke-4"),
    "Excluded tripod was still recommended.",
  );
  return {
    release: metadata.release,
    checks: [
      "greeting",
      "complete nested location",
      "AI packing",
      "packing follow-up",
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await runDeployedSmoke({
      url: process.env.DEMO_URL || "https://inventory-lime-one.vercel.app",
      expectedRelease: process.env.EXPECTED_RELEASE || "",
    });
    console.info(JSON.stringify(result));
  } catch (error) {
    console.error(
      `Deployed smoke failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
}
