"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase/client";
export function AuthForm({
  confirmationError = false,
}: {
  confirmationError?: boolean;
}) {
  const router = useRouter();
  const [signup, setSignup] = useState(false),
    [message, setMessage] = useState(
      confirmationError
        ? "That confirmation link expired or is invalid. Please sign in or request a new account confirmation."
        : "",
    ),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const client = browserClient(),
        credentials = {
          email: String(data.get("email")),
          password: String(data.get("password")),
        };
      const { data: auth, error } = signup
        ? await client.auth.signUp({
            ...credentials,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/confirm`,
            },
          })
        : await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (auth.session) router.refresh();
      else
        setMessage("Check your email to confirm your account, then sign in.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <h2>{signup ? "Make yourself at home." : "Welcome back."}</h2>
      <p className="muted">
        {signup
          ? "Create your private inventory."
          : "Your things, right where you left them."}
      </p>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={signup ? "new-password" : "current-password"}
          placeholder="At least 8 characters"
        />
      </label>
      <button className="primary" disabled={busy}>
        {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
      </button>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setSignup(!signup);
          setMessage("");
        }}
      >
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </form>
  );
}
