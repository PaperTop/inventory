import { afterEach, expect, it, vi } from "vitest";
import { handleLocalAsk } from "../src/lib/handlers";
import type { InventoryFact } from "../src/lib/ask";

afterEach(() => vi.unstubAllEnvs());
const camera: InventoryFact = {
  id: "camera",
  name: "Camera",
  description: "Compact travel camera",
  category: "Electronics",
  quantity: 1,
  unit: "pc",
  status: "stored",
  condition: "good",
  location_name: "Bedroom → Cabinet → Drawer",
  tags: [],
  attributes: {},
};
function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/ask/local", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
it("answers from the submitted local snapshot and passes bounded conversation context", async () => {
  const history = [{ question: "What takes pictures?", answer: "Camera." }];
  const response = await handleLocalAsk(
    request({ question: "Where is it?", items: [camera], history }),
    {
      async answer(context, reader) {
        expect(context.history).toEqual(history);
        const found = await reader!.search("camera");
        return {
          answer: `${found[0].name} is in ${found[0].location_name}.`,
          itemIds: [found[0].id],
        };
      },
    },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    mode: "ai",
    citations: [camera],
    answer: "Camera is in Bedroom → Cabinet → Drawer.",
  });
});
it("uses edited records and does not retain prior snapshots", async () => {
  const first = await handleLocalAsk(
    request({ question: "camera", items: [camera] }),
  );
  expect((await first.json()).citations).toHaveLength(1);
  const second = await handleLocalAsk(
    request({ question: "camera", items: [] }),
  );
  expect((await second.json()).citations).toHaveLength(0);
});
it("rejects cross-origin local AI requests", async () => {
  expect(
    (
      await handleLocalAsk(
        request(
          { question: "camera", items: [camera] },
          "https://other.example",
        ),
      )
    ).status,
  ).toBe(403);
});
it("accepts a same-origin loopback request when Next normalizes its internal URL to localhost", async () => {
  const req = request(
    { question: "camera", items: [camera] },
    "http://127.0.0.1:3000",
  );
  req.headers.set("host", "127.0.0.1:3000");
  expect((await handleLocalAsk(req)).status).toBe(200);
});
it("disables unauthenticated local inference in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(
    (await handleLocalAsk(request({ question: "camera", items: [camera] })))
      .status,
  ).toBe(404);
});
it.each([
  { question: "camera", items: [camera, camera] },
  { question: "camera", items: [{ ...camera, quantity: -1 }] },
  { question: "camera", items: [{ ...camera, user_id: "someone-else" }] },
  {
    question: "camera",
    items: Array.from({ length: 5001 }, (_, index) => ({
      ...camera,
      id: String(index),
    })),
  },
  {
    question: "camera",
    items: [camera],
    history: Array.from({ length: 7 }, () => ({ question: "a", answer: "b" })),
  },
])("rejects malformed or oversized local context %#", async (body) => {
  expect((await handleLocalAsk(request(body))).status).toBe(400);
});
it("bounds the actual request body before parsing", async () => {
  expect(
    (
      await handleLocalAsk(
        request({ question: "x".repeat(8_000_001), items: [] }),
      )
    ).status,
  ).toBe(413);
});
