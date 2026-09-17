import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../src/app/auth/confirm/route";
const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  configured: vi.fn(() => true),
}));
vi.mock("../src/lib/supabase/config", () => ({
  isConfigured: mocks.configured,
}));
vi.mock("../src/lib/supabase/server", () => ({
  serverClient: async () => ({ auth: { verifyOtp: mocks.verifyOtp } }),
}));
afterEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
});

it("confirms email, redirects home with feedback, and never follows a supplied redirect", async () => {
  mocks.verifyOtp.mockResolvedValue({ error: null });
  const response = await GET(
    new Request(
      "https://inventory.test/auth/confirm?token_hash=synthetic&type=email&next=https://evil.test",
    ),
  );
  expect(mocks.verifyOtp).toHaveBeenCalledWith({
    token_hash: "synthetic",
    type: "email",
  });
  expect(response.headers.get("location")).toBe(
    "https://inventory.test/?auth=confirmed",
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it.each(["", "?token_hash=synthetic&type=recovery", "?type=email"])(
  "rejects missing or unsupported confirmation input %s",
  async (query) => {
    const response = await GET(
      new Request(`https://inventory.test/auth/confirm${query}`),
    );
    expect(response.headers.get("location")).toBe(
      "https://inventory.test/?authError=confirmation",
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  },
);
it("handles expired links, service failure, and missing configuration", async () => {
  const request = new Request(
    "https://inventory.test/auth/confirm?token_hash=synthetic&type=email",
  );
  mocks.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
  expect((await GET(request)).headers.get("location")).toContain(
    "authError=confirmation",
  );
  mocks.verifyOtp.mockRejectedValue(new Error("Network unavailable"));
  expect((await GET(request)).headers.get("location")).toContain(
    "authError=unavailable",
  );
  mocks.configured.mockReturnValue(false);
  expect((await GET(request)).headers.get("location")).toContain(
    "authError=setup",
  );
});
