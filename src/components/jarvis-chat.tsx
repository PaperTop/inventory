"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  ArrowCounterClockwise,
  PaperPlaneTilt,
  Sparkle,
} from "@phosphor-icons/react";
import { askInventory, inventoryFacts, type AskResult } from "@/lib/ask";
import { searchFacts } from "@/lib/inventory-search";
import { askApi, askLocalApi } from "@/lib/browser-api";
import type { VisualItem } from "./use-inventory-store";
import type { ChangeOutcome, InventoryChange } from "@/lib/inventory-changes";
import styles from "./liquid-dashboard.module.css";

type Exchange = { question: string; result?: AskResult; source: string };

export function JarvisChat({
  items,
  saved,
  onSelect,
  onApplyChanges,
}: {
  items: VisualItem[];
  saved: boolean;
  onSelect: (id: string) => void;
  onApplyChanges: (
    changes: InventoryChange[],
    versions: Record<string, number>,
  ) => Promise<ChangeOutcome>;
}) {
  const [prompt, setPrompt] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const currentTarget = useRef({ saved, onApplyChanges });

  useEffect(() => {
    currentTarget.current = { saved, onApplyChanges };
  }, [saved, onApplyChanges]);

  useEffect(() => {
    if (transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [exchanges, busy]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || sending.current) return;
    sending.current = true;
    setBusy(true);
    setPrompt("");
    const history = exchanges
      .filter((turn) => turn.result)
      .slice(-6)
      .map((turn) => ({
        question: turn.question,
        answer: turn.result!.answer,
      }));
    const facts = inventoryFacts(items);
    const versions = Object.fromEntries(
      items.map((item) => [item.id, item.version]),
    );
    const source = saved
      ? "Your saved inventory"
      : "Local inventory · this session";
    setExchanges((current) => [...current, { question, source }]);
    let result: AskResult;
    try {
      result = saved
        ? await askApi(question, history)
        : await askLocalApi(question, facts, history);
    } catch {
      result = await askInventory(question, {
        search: async (query) => searchFacts(facts, query),
      });
      result.notice =
        "Jarvis could not reach the AI service. Showing local search results; follow-up context needs AI.";
    }
    if (result.changes?.length) {
      const outcome =
        currentTarget.current.saved === saved
          ? await currentTarget.current.onApplyChanges(result.changes, versions)
          : {
              items: [],
              summary: "No items were changed.",
              error:
                "The inventory source changed while Jarvis was answering. Ask again using the current inventory.",
            };
      result = {
        ...result,
        answer: outcome.summary,
        citations: inventoryFacts(outcome.items),
        notice: outcome.error,
      };
    }
    setExchanges((current) =>
      current.map((turn, index) =>
        index === current.length - 1 ? { ...turn, result } : turn,
      ),
    );
    sending.current = false;
    setBusy(false);
    input.current?.focus();
  }

  function resetChat() {
    if (busy) return;
    setExchanges([]);
    setPrompt("");
    input.current?.focus();
  }

  return (
    <form
      className={`${styles.glass} ${styles.assistant}`}
      aria-label="Jarvis"
      onSubmit={ask}
    >
      <div className={styles.assistantHeader}>
        <div className={styles.assistantTitle}>
          <span className={styles.orb}>
            <Sparkle weight="fill" />
          </span>
          <div>
            <h2>Jarvis</h2>
            <span>Your inventory assistant</span>
          </div>
        </div>
        {exchanges.length > 0 && (
          <button
            type="button"
            className={styles.assistantReset}
            onClick={resetChat}
            disabled={busy}
            aria-label="Reset chat"
            title="Reset conversation"
          >
            <ArrowCounterClockwise size={13} weight="bold" />
            <span>Reset</span>
          </button>
        )}
      </div>
      <div className={styles.assistantSuggestions}>
        {[
          "Pack me for camping",
          "What can I use to take pictures?",
          "Show my camera accessories",
        ].map((question) => (
          <button
            key={question}
            type="button"
            disabled={busy}
            onClick={() => {
              setPrompt(question);
              input.current?.focus();
            }}
          >
            {question}
          </button>
        ))}
      </div>
      <div
        ref={transcript}
        className={styles.assistantTranscript}
        role="log"
        aria-label="Jarvis conversation"
        aria-live="polite"
        aria-busy={busy}
      >
        {!exchanges.length && (
          <p className={styles.assistantWelcome}>
            Tell me what you’re planning. I’ll look through your things and help
            you find what fits. You can also ask me to add or edit an item.
          </p>
        )}
        {exchanges.map((turn, index) => (
          <div className={styles.assistantExchange} key={index}>
            <p className={styles.assistantQuestion}>{turn.question}</p>
            {turn.result && (
              <>
                <small className={styles.assistantSource}>
                  {turn.source} ·{" "}
                  {turn.result.mode === "ai" ? "AI answer" : "Search results"}
                </small>
                <p className={styles.assistantAnswer}>{turn.result.answer}</p>
                <div className={styles.assistantResults}>
                  {turn.result.citations.map((item) => {
                    const current = items.find((row) => row.id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={`Open ${item.name}`}
                        disabled={!current}
                        onClick={() => onSelect(item.id)}
                      >
                        {current && (
                          <Image
                            src={current.image}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                          />
                        )}
                        <span>
                          <strong>{item.name}</strong>
                          <span>
                            {item.quantity} {item.unit} ·{" "}
                            {item.location_name || "No location"}
                          </span>
                          <span>
                            {item.status}
                            {item.condition === "poor"
                              ? " · poor condition"
                              : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {turn.result.notice && (
                  <p className={styles.assistantNotice}>{turn.result.notice}</p>
                )}
              </>
            )}
          </div>
        ))}
        {busy && (
          <p className={styles.assistantNotice}>
            Looking through your inventory…
          </p>
        )}
      </div>
      <div className={styles.assistantComposer}>
        <label>
          <input
            ref={input}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask about your things…"
            aria-label="Ask Jarvis"
            maxLength={1000}
          />
        </label>
        <button aria-label="Send question" disabled={busy || !prompt.trim()}>
          <PaperPlaneTilt weight="fill" />
        </button>
      </div>
    </form>
  );
}
