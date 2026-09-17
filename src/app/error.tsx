"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <section className="error-card">
        <span>Inventory</span>
        <h1>Let’s try that again.</h1>
        <p>
          Inventory could not load. Check your connection and account settings.
        </p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
