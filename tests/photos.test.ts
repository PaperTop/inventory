import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createPhotoReader, handlePhoto } from "../src/lib/photo-reader";
import { safely } from "../src/lib/http";
import { MAX_PHOTO_BYTES, validatePhotoFile } from "../src/lib/photos";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
const path = `${owner}/44444444-4444-4444-8444-444444444444.png`;
const request = new Request(`https://inventory.test/api/items/${itemId}/photo`);

function fixture(imagePath: string | null = path, storageFails = false) {
  const fetch = vi.fn(
    async (input: RequestInfo | URL, _options?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/rest/v1/items") {
        expect(url.searchParams.get("id")).toBe(`eq.${itemId}`);
        expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
        return Response.json(
          imagePath === null ? null : { attributes: { image_path: imagePath } },
        );
      }
      if (
        url.pathname.startsWith("/storage/v1/object/sign/inventory-photos/")
      ) {
        expect(_options?.method).toBe("POST");
        return storageFails
          ? Response.json({ message: "Missing bucket" }, { status: 400 })
          : Response.json({
              signedURL: `/object/sign/inventory-photos/${path}?token=short-lived`,
            });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    },
  );
  const client = createClient("https://storage.test", "test-key", {
    global: { fetch },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return {
    fetch,
    context: { userId: owner, read: createPhotoReader(client, owner) },
  };
}

describe("private photo reads", () => {
  it("checks the item owner and issues an uncached short-lived redirect", async () => {
    const { fetch, context } = fixture();
    const response = await safely(() => handlePhoto(request, itemId, context));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "https://storage.test/storage/v1/object/sign/inventory-photos/",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    const signOptions = fetch.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(signOptions.body as string)).toMatchObject({
      expiresIn: 60,
    });
  });

  it("rejects anonymous requests and invalid item IDs", async () => {
    expect(
      (await safely(() => handlePhoto(request, itemId, null))).status,
    ).toBe(401);
    const { fetch, context } = fixture();
    expect(
      (await safely(() => handlePhoto(request, "invalid", context))).status,
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    null,
    `${other}/44444444-4444-4444-8444-444444444444.png`,
    `${owner}/../secret.png`,
    "https://evil.test/image.png",
    "/inventory-assets/camera.png",
  ])(
    "does not sign a missing, foreign, or invalid photo reference: %s",
    async (value) => {
      const { fetch, context } = fixture(value);
      expect(
        (await safely(() => handlePhoto(request, itemId, context))).status,
      ).toBe(404);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores caller-supplied image paths and reads the stored reference", async () => {
    const { context } = fixture();
    const response = await safely(() =>
      handlePhoto(
        new Request(
          `${request.url}?image=${encodeURIComponent(`${other}/secret.png`)}`,
        ),
        itemId,
        context,
      ),
    );
    expect(response.headers.get("location")).toContain(path);
  });

  it("reports unavailable storage privately without leaking provider details", async () => {
    const { context } = fixture(path, true);
    const response = await safely(() => handlePhoto(request, itemId, context));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("Missing bucket");
  });
});

it("limits photos to nonempty JPG, PNG, and WebP files up to 5 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    expect(() =>
      validatePhotoFile({ type, size: MAX_PHOTO_BYTES }),
    ).not.toThrow();
  expect(() => validatePhotoFile({ type: "image/svg+xml", size: 1 })).toThrow(
    /JPG, PNG, or WebP/,
  );
  for (const size of [0, MAX_PHOTO_BYTES + 1])
    expect(() => validatePhotoFile({ type: "image/png", size })).toThrow(
      /5 MB/,
    );
});
