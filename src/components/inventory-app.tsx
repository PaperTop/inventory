"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { browserClient } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/supabase/config";
import { apiRepository } from "@/lib/browser-api";
import type { Item, Location } from "@/lib/inventory";
import { LiquidDashboard } from "./liquid-dashboard";
import { AccountForm } from "./account-form";
import styles from "./account-panel.module.css";

type Account = { id: string; email?: string };
export type SavedInventory = { items: Item[]; locations: Location[] };

function AccountDialog({
  configured,
  onClose,
}: {
  configured: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (element.showModal) element.showModal();
    else element.setAttribute("open", "");
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="account-title"
      onClose={onClose}
    >
      <button
        className={styles.close}
        onClick={onClose}
        aria-label="Close account panel"
      >
        ×
      </button>
      <h1 id="account-title">Your private inventory</h1>
      <AccountForm configured={configured} onAuthenticated={onClose} />
      <button className={styles.textButton} onClick={onClose}>
        Continue with sample inventory
      </button>
    </dialog>
  );
}

function AccountScreen({
  title,
  children,
  controls,
}: {
  title: string;
  children?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <h1>{title}</h1>
        {children}
        {controls}
      </section>
    </main>
  );
}

function SavedWorkspace({
  user,
  controls,
}: {
  user: Account;
  controls: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<SavedInventory | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([apiRepository.list(""), apiRepository.locations()])
      .then(([items, locations]) => {
        if (!active) return;
        if (
          items.some((item) => item.user_id !== user.id) ||
          locations.some((place) => place.user_id !== user.id)
        )
          throw new Error(
            "Your session changed while inventory was loading. Retry to load the current account.",
          );
        setSnapshot({ items, locations });
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load your saved inventory.",
          );
      });
    return () => {
      active = false;
    };
  }, [user.id, attempt]);
  if (error)
    return (
      <AccountScreen title="Your inventory could not load" controls={controls}>
        <p role="alert" className={styles.error}>
          {error}
        </p>
        <p className={styles.description}>
          Your saved data has not been replaced with sample items.
        </p>
        <button
          className={styles.secondary}
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Retry loading inventory
        </button>
      </AccountScreen>
    );
  if (!snapshot)
    return (
      <AccountScreen title="Loading your inventory" controls={controls}>
        <p role="status">Connecting to your private workspace…</p>
      </AccountScreen>
    );
  return (
    <LiquidDashboard
      savedInventory={snapshot}
      accountControls={controls}
      accountEmail={user.email}
    />
  );
}

export function InventoryApp() {
  const configured = isConfigured();
  const [user, setUser] = useState<Account | null | undefined>(
    configured ? undefined : null,
  );
  const [showAccount, setShowAccount] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const logoutPending = useRef(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get("authError");
    const confirmed = url.searchParams.get("auth") === "confirmed";
    if (authError || confirmed) {
      const text = confirmed
        ? "Email confirmed. You can now sign in to your inventory."
        : authError === "setup"
          ? "Account sign-in is not connected yet. Please try again after setup."
          : authError === "unavailable"
            ? "Email confirmation is temporarily unavailable. Try opening the email link again."
            : "This confirmation link is invalid or expired. Sign in to request another confirmation email.";
      queueMicrotask(() => setFeedback({ text, error: !confirmed }));
      url.searchParams.delete("authError");
      url.searchParams.delete("auth");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    if (!configured) return;
    let active = true;
    // Keep the callback synchronous: awaiting another Auth call here can lock
    // the Supabase client. Inventory loads independently after the user changes.
    const {
      data: { subscription },
    } = browserClient().auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(
        session?.user
          ? { id: session.user.id, email: session.user.email }
          : null,
      );
      if (session?.user) setShowAccount(false);
      if (event === "SIGNED_OUT")
        setFeedback({ text: "Signed out. You are viewing sample inventory." });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  async function signOut() {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setSigningOut(true);
    setFeedback(null);
    try {
      const { error } = await browserClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      setUser(null);
      setFeedback({ text: "Signed out. You are viewing sample inventory." });
    } catch {
      setFeedback({
        text: "Could not sign out. Your session may still be active. Check your connection and try again.",
        error: true,
      });
    } finally {
      logoutPending.current = false;
      setSigningOut(false);
    }
  }

  const controls = (
    <div className={styles.controls} aria-label="Account">
      {user ? (
        <>
          <span className={styles.email} title={user.email}>
            {user.email ?? "Signed in"}
          </span>
          <button className={styles.secondary} onClick={signOut}>
            Sign out
          </button>
        </>
      ) : (
        <button
          className={styles.secondary}
          onClick={() => setShowAccount(true)}
        >
          Sign in
        </button>
      )}
    </div>
  );

  return (
    <>
      {signingOut ? (
        <AccountScreen title="Signing out…">
          <p role="status">Clearing this workspace.</p>
        </AccountScreen>
      ) : user === undefined ? (
        <AccountScreen title="Inventory">
          <p role="status">Checking your session…</p>
        </AccountScreen>
      ) : user ? (
        <SavedWorkspace key={user.id} user={user} controls={controls} />
      ) : (
        <LiquidDashboard key="sample" accountControls={controls} />
      )}
      {feedback && (
        <div
          className={styles.banner}
          role={feedback.error ? "alert" : "status"}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            aria-label="Dismiss account message"
          >
            ×
          </button>
        </div>
      )}
      {showAccount && !user && (
        <AccountDialog
          configured={configured}
          onClose={() => setShowAccount(false)}
        />
      )}
    </>
  );
}
