// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { AccountForm } from "../src/components/account-form";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({ auth }),
}));
beforeEach(() => {
  auth.signInWithPassword.mockResolvedValue({
    data: { session: {} },
    error: null,
  });
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  auth.resend.mockResolvedValue({ error: null });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("signs in with email/password and never persists the password in the app", async () => {
  const user = userEvent.setup(),
    done = vi.fn();
  render(<AccountForm configured onAuthenticated={done} />);
  await user.type(screen.getByLabelText("Email"), "person@example.com");
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "test-password",
  );
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: "person@example.com",
    password: "test-password",
  });
  expect(done).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
});

it("signs up with a matching password and waits for email confirmation", async () => {
  const user = userEvent.setup(),
    done = vi.fn();
  render(<AccountForm configured onAuthenticated={done} />);
  await user.click(screen.getByRole("button", { name: "Create an account" }));
  await user.type(screen.getByLabelText("Email"), "person@example.com");
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "test-password",
  );
  await user.type(
    screen.getByLabelText("Confirm password"),
    "different-password",
  );
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
  expect(auth.signUp).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Confirm password"));
  await user.type(screen.getByLabelText("Confirm password"), "test-password");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(auth.signUp).toHaveBeenCalledWith({
    email: "person@example.com",
    password: "test-password",
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
  });
  expect(screen.getByRole("status")).toHaveTextContent(/check your inbox/i);
  expect(done).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
});

it("reports unconfirmed email and resends only on explicit request", async () => {
  const user = userEvent.setup();
  auth.signInWithPassword.mockResolvedValue({
    error: { code: "email_not_confirmed" },
  });
  render(<AccountForm configured onAuthenticated={vi.fn()} />);
  await user.type(screen.getByLabelText("Email"), "person@example.com");
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "test-password",
  );
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/confirm your email/i);
  expect(auth.resend).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Resend confirmation email" }),
  );
  expect(auth.resend).toHaveBeenCalledWith({
    type: "signup",
    email: "person@example.com",
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
  });
  expect(screen.getByRole("status")).toHaveTextContent(/check your inbox/i);
});

it.each(["invalid_credentials", "over_request_rate_limit", "unexpected"])(
  "reports %s without exposing provider internals",
  async (code) => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockResolvedValue({
      error: { code, message: "internal provider detail" },
    });
    render(<AccountForm configured onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "test-password",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "internal provider detail",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  },
);

it("keeps sample mode available when account sign-in is not configured", () => {
  render(<AccountForm configured={false} onAuthenticated={vi.fn()} />);
  expect(screen.getByText(/sign-in isn’t connected/i)).toBeVisible();
  expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
});
