import { afterEach, expect, it, vi } from "vitest";
import { createDemoUsageGuard } from "../src/lib/demo-ai-limits";

afterEach(() => vi.unstubAllEnvs());
const request = (ip = "192.0.2.1") =>
  new Request("https://demo.example/api/ask/local", {
    headers: { "x-forwarded-for": ip },
  });

it("bounds per-client usage and resets after the window", () => {
  vi.stubEnv("VERCEL", "1");
  let time = 0;
  const acquire = createDemoUsageGuard(() => time);
  for (let i = 0; i < 6; i++) acquire(request())();
  expect(() => acquire(request())).toThrow(/usage limit/);
  expect(() => acquire(request("192.0.2.2"))()).not.toThrow();
  time = 600001;
  expect(() => acquire(request())()).not.toThrow();
});

it("bounds concurrent work and releases a slot only once", () => {
  const acquire = createDemoUsageGuard();
  const first = acquire(request());
  const second = acquire(request());
  expect(() => acquire(request())).toThrow(/usage limit/);
  first();
  first();
  const third = acquire(request());
  expect(() => acquire(request())).toThrow(/usage limit/);
  second();
  third();
});

it("bounds hourly requests across clients, not just individual addresses", () => {
  vi.stubEnv("VERCEL", "1");
  let time = 0;
  const acquire = createDemoUsageGuard(() => time);
  for (let i = 0; i < 60; i++) acquire(request(`192.0.2.${i}`))();
  expect(() => acquire(request("new-client"))).toThrow(/usage limit/);
  time = 3600001;
  expect(() => acquire(request())()).not.toThrow();
});

it("does not trust forwarded identities outside Vercel", () => {
  vi.stubEnv("VERCEL", "");
  const acquire = createDemoUsageGuard();
  for (let i = 0; i < 6; i++) acquire(request(`spoof-${i}`))();
  expect(() => acquire(request("another-spoof"))).toThrow(/usage limit/);
});
