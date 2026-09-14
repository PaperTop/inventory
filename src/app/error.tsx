"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="welcome">
      <h1>Let’s try that again.</h1>
      <p>
        Inventory could not load. Check your connection and account settings.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
