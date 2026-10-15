import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRepository } from "../src/lib/repository";
import { itemInput } from "../src/lib/inventory";

it("returns a confirmed insert when only subsequent hierarchy hydration fails", async () => {
  const input = itemInput.parse({ name: "Camera" });
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const client = {
    rpc: (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "create_inventory_item")
        return {
          maybeSingle: async () => ({
            data: {
              ...input,
              id,
              user_id: "owner",
              version: 1,
              created_at: "",
              updated_at: "",
            },
            error: null,
          }),
        };
      return Promise.resolve({
        data: null,
        error: { code: "network", message: "Unavailable" },
      });
    },
  } as unknown as SupabaseClient;
  const result = await createRepository(client, "owner").create(
    input,
    "user",
    id,
  );
  expect(result.id).toBe(id);
  expect(calls[0].args?.request_id).toBe(id);
  expect(
    calls.filter((call) => call.name === "create_inventory_item"),
  ).toHaveLength(1);
});
