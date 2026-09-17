"use client";

import { useRef, useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase/client";
import styles from "./account-panel.module.css";

function authMessage(error: { code?: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email before signing in. Check your inbox or resend the confirmation email.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "email_address_not_authorized":
      return "Email delivery is not configured for this address yet. Contact the project owner.";
    case "weak_password":
      return "Choose a stronger password. Use at least 8 characters with a mix of letters, numbers, and symbols.";
    case "user_already_exists":
      return "An account with this email already exists. Try signing in.";
    case "signup_disabled":
      return "New account registration is currently disabled.";
    default:
      return "Could not complete this request. Check your connection and try again.";
  }
}

export function AccountForm({
  configured,
  onAuthenticated,
}: {
  configured: boolean;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [canResend, setCanResend] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (running.current) return;
    setError("");
    setMessage("");
    if (mode === "signup" && password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      const auth = browserClient().auth;
      const result =
        mode === "login"
          ? await auth.signInWithPassword({ email: email.trim(), password })
          : await auth.signUp({
              email: email.trim(),
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/confirm`,
              },
            });
      if (result.error) {
        setError(authMessage(result.error));
        setCanResend(result.error.code === "email_not_confirmed");
        return;
      }
      setPassword("");
      setConfirmation("");
      if (result.data.session) {
        onAuthenticated();
      } else {
        setMessage(
          "Check your inbox for a confirmation link. If you already have an account, sign in instead.",
        );
        setCanResend(true);
      }
    } catch {
      setError("Could not reach sign-in. Check your connection and try again.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    if (running.current || !emailInput.current?.reportValidity()) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await browserClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) setError(authMessage(error));
      else
        setMessage(
          "Check your inbox. If this account needs confirmation, a new link will arrive shortly.",
        );
    } catch {
      setError(
        "Could not send the email. Check your connection and try again.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  if (!configured)
    return (
      <p className={styles.description}>
        Account sign-in isn’t connected yet. You can explore the sample
        inventory.
      </p>
    );

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      aria-label={
        mode === "login"
          ? "Sign in to Inventory"
          : "Create your Inventory account"
      }
    >
      <p className={styles.description}>
        {mode === "login"
          ? "Your things, wherever you are. Sign in to keep your inventory and photos saved."
          : "Create your private workspace. Your inventory starts empty, ready for your own things."}
      </p>
      <label>
        Email
        <input
          ref={emailInput}
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          maxLength={128}
          value={password}
          disabled={busy}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {mode === "signup" && (
        <>
          <small>Use at least 8 characters.</small>
          <label>
            Confirm password
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              required
              value={confirmation}
              disabled={busy}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.message}>
          {message}
        </p>
      )}
      <button className={styles.primary} disabled={busy}>
        {busy
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>
      {canResend && (
        <button
          className={styles.secondary}
          type="button"
          disabled={busy}
          onClick={resend}
        >
          Resend confirmation email
        </button>
      )}
      <button
        className={styles.textButton}
        type="button"
        disabled={busy}
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
          setMessage("");
          setPassword("");
          setConfirmation("");
          setCanResend(false);
        }}
      >
        {mode === "login"
          ? "Create an account"
          : "Already have an account? Sign in"}
      </button>
      <p className={styles.finePrint}>
        Sample items stay separate from your account.
      </p>
    </form>
  );
}
