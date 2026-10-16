"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowCounterClockwise,
  PaperPlaneRight,
  Sparkle,
} from "@phosphor-icons/react";
import { askInventory, inventoryFacts, type AskResult } from "@/lib/ask";
import { searchFacts } from "@/lib/inventory-search";
import { askApi, askLocalApi } from "@/lib/browser-api";
import type { VisualItem } from "./use-inventory-store";
import type { ChangeOutcome, InventoryChange } from "@/lib/inventory-changes";
import styles from "./inventory-dashboard.module.css";
import type { Location } from "@/lib/inventory";
import { JarvisInventoryResults } from "./jarvis-inventory-results";

type Exchange = { question: string; result?: AskResult; source: string };

export function JarvisChat({
  items,
  saved,
  onSelect,
  onApplyChanges,
  promptRequest,
  active = true,
  children,
  locations = [],
}: {
  items: VisualItem[];
  saved: boolean;
  onSelect: (id: string) => void;
  onApplyChanges: (
    changes: InventoryChange[],
    versions: Record<string, number>,
  ) => Promise<ChangeOutcome>;
  promptRequest?: {
    text: string;
    id: number;
    submit?: boolean;
    focusOnly?: boolean;
  };
  active?: boolean;
  children?: ReactNode;
  locations?: Location[];
}) {
  const [prompt, setPrompt] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const handledRequest = useRef<number | undefined>(undefined);
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const sendRequest = useEffectEvent((text: string) => {
    void send(text);
  });
  const focusConversation = useEffectEvent(() => {
    input.current?.focus();
    if (exchanges.length)
      transcript.current?.scrollIntoView?.({ block: "end" });
  });
  useEffect(() => {
    if (!promptRequest || handledRequest.current === promptRequest.id) return;
    handledRequest.current = promptRequest.id;
    if (promptRequest.submit && !sending.current) {
      sendRequest(promptRequest.text);
      return;
    }
    queueMicrotask(() => {
      if (mounted.current && !promptRequest.focusOnly)
        setPrompt(promptRequest.text);
    });
  }, [promptRequest]);
  useEffect(() => {
    if (!active || !promptRequest) return;
    // Navigation and item-detail cleanup restore their old focus in microtasks.
    // Focus the shared composer after those restorations have finished.
    const timer = setTimeout(() => focusConversation(), 0);
    return () => clearTimeout(timer);
  }, [active, promptRequest]);
  const currentTarget = useRef({ saved, onApplyChanges });

  useEffect(() => {
    currentTarget.current = { saved, onApplyChanges };
  }, [saved, onApplyChanges]);

  useEffect(() => {
    if (active && exchanges.length)
      transcript.current?.scrollIntoView?.({ block: "end" });
  }, [active, busy, exchanges]);

  async function send(rawQuestion: string) {
    const question = rawQuestion.trim();
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
        : await askLocalApi(question, facts, history, locations);
    } catch {
      result = await askInventory(
        question,
        {
          search: async (query) => searchFacts(facts, query),
        },
        undefined,
        history,
      );
      if (!result.clarification && !result.conversational)
        result.notice =
          "Jarvis could not reach the AI service. Showing local search results using your conversation context.";
    }
    if (!mounted.current) return;
    if (result.changes?.length) {
      let outcome: ChangeOutcome;
      try {
        outcome =
          currentTarget.current.saved === saved
            ? await currentTarget.current.onApplyChanges(
                result.changes,
                versions,
              )
            : {
                items: [],
                summary: "No items were changed.",
                error:
                  "The inventory source changed while Jarvis was answering. Ask again using the current inventory.",
              };
      } catch {
        outcome = {
          items: [],
          summary: "Jarvis could not finish saving your changes.",
          error:
            "Check your inventory before trying again; some changes may have been saved.",
        };
      }
      result = {
        ...result,
        answer: outcome.summary,
        citations: inventoryFacts(outcome.items),
        notice: outcome.error,
      };
    }
    if (!mounted.current) return;
    setExchanges((current) =>
      current.map((turn, index) =>
        index === current.length - 1 ? { ...turn, result } : turn,
      ),
    );
    sending.current = false;
    setBusy(false);
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    await send(prompt);
  }

  function resetChat() {
    if (busy) return;
    setExchanges([]);
    setPrompt("");
    input.current?.focus();
  }

  return (
    <form className={styles.assistant} aria-label="Jarvis" onSubmit={ask}>
      {children}
      {exchanges.length > 0 && (
        <div className={styles.assistantHeader}>
          <div className={styles.assistantTitle}>
            <span className={styles.orb}>
              <Sparkle weight="fill" />
            </span>
            <div>
              <h2>Jarvis</h2>
            </div>
          </div>
          {exchanges.length > 0 && (
            <button
              type="button"
              className={styles.assistantReset}
              onClick={resetChat}
              disabled={busy}
              aria-label="Reset conversation"
              title="Reset conversation"
            >
              <ArrowCounterClockwise size={13} weight="bold" />
              <span>Reset</span>
            </button>
          )}
        </div>
      )}
      <div
        ref={transcript}
        className={styles.assistantTranscript}
        role="log"
        aria-label="Jarvis conversation"
        aria-live="polite"
        aria-busy={busy}
      >
        {exchanges.map((turn, index) => (
          <div className={styles.assistantExchange} key={index}>
            <p className={styles.assistantQuestion}>{turn.question}</p>
            {turn.result && (
              <>
                <small className={styles.assistantSource}>
                  {turn.source} ·{" "}
                  {turn.result.conversational
                    ? "Jarvis"
                    : turn.result.clarification
                      ? "Trip questions"
                      : turn.result.mode === "ai"
                        ? "AI answer"
                        : "Search results"}
                </small>
                {turn.result.contextNotice && (
                  <p className={styles.assistantNotice}>
                    {turn.result.contextNotice}
                  </p>
                )}
                <p className={styles.assistantAnswer}>{turn.result.answer}</p>
                <JarvisInventoryResults
                  result={turn.result}
                  items={items}
                  locations={locations}
                  saved={saved}
                  onSelect={onSelect}
                />
                {turn.result.notice && (
                  <p className={styles.assistantNotice}>{turn.result.notice}</p>
                )}
              </>
            )}
          </div>
        ))}
        {busy && (
          <p className={styles.assistantNotice} role="status">
            Jarvis is looking through your inventory…
          </p>
        )}
      </div>
      <div className={styles.composer}>
        <label htmlFor="dashboard-jarvis-prompt">Ask Jarvis</label>
        <input
          id="dashboard-jarvis-prompt"
          ref={input}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask Jarvis…"
          autoComplete="off"
          aria-label="Ask Jarvis"
          maxLength={1000}
        />
        <button
          type="submit"
          aria-label="Send to Jarvis"
          disabled={busy || !prompt.trim()}
        >
          <PaperPlaneRight weight="bold" />
        </button>
      </div>
    </form>
  );
}
