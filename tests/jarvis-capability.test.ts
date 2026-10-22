import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/ask/local/route";
import { jarvisAvailability } from "../src/lib/provider";

afterEach(() => vi.unstubAllEnvs());
it("exposes only capability and release, never provider credentials", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEMO_AI_ENABLED", "true");
  vi.stubEnv("AI_PROVIDER", "claude");
  vi.stubEnv("ANTHROPIC_MODEL", "test-model");
  vi.stubEnv("ANTHROPIC_API_KEY", "private-test-key");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "test-release");
  expect(jarvisAvailability()).toEqual({ demo: true, saved: true });
  const response = GET();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({
    mode: "ai",
    release: "test-release",
  });
  vi.stubEnv("DEMO_AI_ENABLED", "false");
  expect(jarvisAvailability()).toEqual({ demo: false, saved: true });
  expect((await GET().json()).mode).toBe("search");
});
it("does not claim AI capability without its required settings", () => {
  vi.stubEnv("AI_PROVIDER", "claude");
  vi.stubEnv("ANTHROPIC_MODEL", "test-model");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  expect(jarvisAvailability()).toEqual({ demo: false, saved: false });
});
